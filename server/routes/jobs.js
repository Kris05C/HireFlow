import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { recordActivity } from '../services/activity.js'

const createJobSchema = z.object({
  title: z.string().trim().min(1).max(160),
  department: z.string().trim().min(1).max(120),
  location: z.string().trim().min(1).max(160),
  type: z.enum(['Full-time', 'Part-time', 'Contract', 'Internship']),
  description: z.string().trim().max(12000).default(''),
  skills: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  preferredSkills: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  experienceYears: z.number().int().min(0).max(70).nullable().optional(),
  workArrangement: z.enum(['onsite', 'hybrid', 'remote', 'unspecified']).default('unspecified'),
  deadline: z.iso.date().nullable().optional(),
}).strict()

const updateJobSchema = z.object({ status: z.enum(['Active', 'Paused', 'Closed']) }).strict()

function mapJob(row) {
  return {
    id: row.id,
    title: row.title,
    department: row.department,
    location: row.location,
    type: row.employment_type,
    status: row.status,
    applicants: row.applicant_count,
    posted: row.created_at.toISOString().slice(0, 10),
    skills: row.required_skills,
    description: row.description,
  }
}

function failValidation(res, error) {
  return res.status(400).json({
    error: 'Check the submitted job information and try again.',
    code: 'VALIDATION_ERROR',
    fields: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
  })
}

export function createJobsRouter(databasePool) {
  const router = Router()

  router.get('/', async (req, res, next) => {
    const query = z.object({ q: z.string().trim().max(160).optional(), status: z.enum(['Active', 'Paused', 'Closed']).optional() }).safeParse(req.query)
    if (!query.success) return failValidation(res, query.error)
    try {
      const result = await databasePool.query(
        `SELECT j.*, count(ci.id)::integer AS applicant_count
         FROM jobs j
         LEFT JOIN candidate_interests ci ON ci.job_id = j.id AND ci.workspace_id = j.workspace_id
         WHERE j.workspace_id = $1
           AND ($2::text IS NULL OR j.status = $2)
           AND ($3::text IS NULL OR concat_ws(' ', j.title, j.department, j.location, j.employment_type) ILIKE '%' || $3 || '%')
         GROUP BY j.id
         ORDER BY j.created_at DESC`,
        [req.workspaceId, query.data.status || null, query.data.q || null],
      )
      return res.json({ jobs: result.rows.map(mapJob) })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/', async (req, res, next) => {
    const parsed = createJobSchema.safeParse(req.body)
    if (!parsed.success) return failValidation(res, parsed.error)
    const job = parsed.data
    const id = randomUUID()
    let client
    try {
      client = await databasePool.connect()
      await client.query('BEGIN')
      const result = await client.query(
        `INSERT INTO jobs
          (id, workspace_id, created_by, title, description, department, location, employment_type,
           work_arrangement, required_skills, preferred_skills, experience_years, deadline)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *, 0::integer AS applicant_count`,
        [id, req.workspaceId, req.session.userId, job.title, job.description, job.department,
          job.location, job.type, job.workArrangement, job.skills, job.preferredSkills,
          job.experienceYears ?? null, job.deadline ?? null],
      )
      await recordActivity(client, {
        workspaceId: req.workspaceId,
        actorId: req.session.userId,
        eventType: 'job.created',
        entityType: 'job',
        entityId: id,
        summary: `Created job: ${job.title}`,
      })
      await client.query('COMMIT')
      return res.status(201).json({ job: mapJob(result.rows[0]) })
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client?.release()
    }
  })

  router.patch('/:id', async (req, res, next) => {
    const id = z.uuid().safeParse(req.params.id)
    const parsed = createJobSchema.safeParse(req.body)
    if (!id.success || !parsed.success) return res.status(400).json({ error: 'Provide valid job details.', code: 'VALIDATION_ERROR' })
    const job = parsed.data
    let client
    try {
      client = await databasePool.connect()
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE jobs SET title = $1, description = $2, department = $3, location = $4,
                         employment_type = $5, work_arrangement = $6, required_skills = $7,
                         preferred_skills = $8, experience_years = $9, deadline = $10, updated_at = now()
         WHERE id = $11 AND workspace_id = $12
         RETURNING *, (SELECT count(*)::integer FROM candidate_interests ci
                       WHERE ci.job_id = jobs.id AND ci.workspace_id = jobs.workspace_id) AS applicant_count`,
        [job.title, job.description, job.department, job.location, job.type, job.workArrangement,
          job.skills, job.preferredSkills, job.experienceYears ?? null, job.deadline ?? null, id.data, req.workspaceId],
      )
      if (!result.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Job not found in this workspace.', code: 'JOB_NOT_FOUND' })
      }
      await recordActivity(client, {
        workspaceId: req.workspaceId,
        actorId: req.session.userId,
        eventType: 'job.updated',
        entityType: 'job',
        entityId: id.data,
        summary: `Updated job: ${job.title}`,
      })
      await client.query('COMMIT')
      return res.json({ job: mapJob(result.rows[0]) })
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client?.release()
    }
  })

  router.patch('/:id/status', async (req, res, next) => {
    const id = z.uuid().safeParse(req.params.id)
    const parsed = updateJobSchema.safeParse(req.body)
    if (!id.success || !parsed.success) return res.status(400).json({ error: 'Provide a valid job and status.', code: 'VALIDATION_ERROR' })
    let client
    try {
      client = await databasePool.connect()
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE jobs SET status = $1, updated_at = now()
         WHERE id = $2 AND workspace_id = $3
         RETURNING *, 0::integer AS applicant_count`,
        [parsed.data.status, id.data, req.workspaceId],
      )
      if (!result.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Job not found in this workspace.', code: 'JOB_NOT_FOUND' })
      }
      const applicantCount = await client.query(
        'SELECT count(*)::integer AS total FROM candidate_interests WHERE job_id = $1 AND workspace_id = $2',
        [id.data, req.workspaceId],
      )
      result.rows[0].applicant_count = applicantCount.rows[0].total
      await recordActivity(client, {
        workspaceId: req.workspaceId,
        actorId: req.session.userId,
        eventType: 'job.status_updated',
        entityType: 'job',
        entityId: id.data,
        summary: `Updated job status to ${parsed.data.status}`,
      })
      await client.query('COMMIT')
      return res.json({ job: mapJob(result.rows[0]) })
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client?.release()
    }
  })

  return router
}