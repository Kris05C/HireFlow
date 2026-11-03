import { createHash, randomUUID } from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { productCatalog } from '../../shared/productCatalog.js'
import { config } from '../config.js'
import { requireWorkspaceRole } from '../middleware/security.js'
import { recordActivity } from '../services/activity.js'

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(120).default(''),
  company: z.string().trim().min(1).max(120),
}).strict()
const campaignSchema = z.object({
  name: z.string().trim().min(1).max(160),
  jobId: z.uuid(),
  subject: z.string().trim().min(1).max(250),
  body: z.string().trim().min(1).max(10000),
}).strict()
const followUpSchema = z.object({
  candidateId: z.uuid(),
  title: z.string().trim().min(1).max(240),
  dueAt: z.iso.datetime(),
}).strict()
const interestStatusSchema = z.object({ status: z.enum(['New', 'Contacted', 'In review', 'Not interested', 'Closed']) }).strict()
const candidateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.union([z.literal(''), z.string().trim().email().max(254)]).optional().transform((value) => value || null),
  role: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(160),
  experienceYears: z.number().min(0).max(70).nullable().optional(),
  skills: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  source: z.literal('candidate-consented-recruiter-entry'),
  discoveryConsent: z.literal(true),
  outreachConsent: z.boolean().default(false),
}).strict().refine((candidate) => !candidate.outreachConsent || Boolean(candidate.email), {
  message: 'An email address is required when outreach consent is enabled.',
  path: ['email'],
})
const candidateDeletionSchema = z.object({ confirm: z.literal(true) }).strict()
const pipelineStatusSchema = z.object({ status: z.enum(['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']) }).strict()
const folderSchema = z.object({ name: z.string().trim().min(1).max(120) }).strict()
const noteSchema = z.object({ body: z.string().trim().min(1).max(5000) }).strict()
const templateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(250),
  body: z.string().trim().min(1).max(10000),
}).strict()
const queueCampaignSchema = z.object({
  idempotencyKey: z.string().trim().min(16).max(200).regex(/^[A-Za-z0-9._:-]+$/),
  candidateIds: z.array(z.uuid()).max(1000).optional(),
}).strict()

function validationError(res, error) {
  return res.status(400).json({
    error: 'Check the submitted information and try again.',
    code: 'VALIDATION_ERROR',
    fields: error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
  })
}

function pageOptions(query) {
  return z.object({
    q: z.string().trim().max(160).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
  }).safeParse(query)
}

async function updateProfile(databasePool, req, res, next) {
  const parsed = profileSchema.safeParse(req.body)
  if (!parsed.success) return validationError(res, parsed.error)
  const client = await databasePool.connect().catch(next)
  if (!client) return
  try {
    await client.query('BEGIN')
    const userResult = await client.query(
      'UPDATE users SET full_name = $1, job_title = $2, updated_at = now() WHERE id = $3 RETURNING id, email, full_name, job_title',
      [parsed.data.name, parsed.data.role, req.session.userId],
    )
    const workspaceResult = await client.query(
      `UPDATE workspaces w SET name = $1, updated_at = now()
       FROM workspace_memberships m
       WHERE w.id = m.workspace_id AND m.workspace_id = $2 AND m.user_id = $3
         AND m.status = 'active' AND m.role IN ('owner', 'admin')
       RETURNING w.id, w.name`,
      [parsed.data.company, req.workspaceId, req.session.userId],
    )
    if (!workspaceResult.rowCount) {
      await client.query('ROLLBACK')
      return res.status(403).json({ error: 'You do not have permission to rename this workspace.', code: 'WORKSPACE_PERMISSION_REQUIRED' })
    }
    await recordActivity(client, {
      workspaceId: req.workspaceId,
      actorId: req.session.userId,
      eventType: 'profile.updated',
      entityType: 'user',
      entityId: req.session.userId,
      summary: 'Updated account and workspace profile',
    })
    await client.query('COMMIT')
    return res.json({
      profile: {
        name: userResult.rows[0].full_name,
        email: userResult.rows[0].email,
        role: userResult.rows[0].job_title,
        company: workspaceResult.rows[0].name,
      },
    })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    return next(error)
  } finally {
    client.release()
  }
}

export function createWorkspaceRouter(databasePool) {
  const router = Router()

  router.get('/profile', async (req, res, next) => {
    try {
      const result = await databasePool.query(
        `SELECT u.id, u.email, u.full_name, u.job_title, m.role AS membership_role, w.id AS workspace_id, w.name AS workspace_name
         FROM users u
         JOIN workspace_memberships m ON m.user_id = u.id AND m.status = 'active'
         JOIN workspaces w ON w.id = m.workspace_id
         WHERE u.id = $1 AND w.id = $2`,
        [req.session.userId, req.workspaceId],
      )
      if (!result.rowCount) return res.status(404).json({ error: 'Workspace profile not found.', code: 'PROFILE_NOT_FOUND' })
      const row = result.rows[0]
      return res.json({ profile: { name: row.full_name, email: row.email, role: row.job_title, company: row.workspace_name, workspaceRole: row.membership_role } })
    } catch (error) {
      return next(error)
    }
  })

  router.patch('/profile', requireWorkspaceRole('owner', 'admin'), (req, res, next) => updateProfile(databasePool, req, res, next))

  router.get('/dashboard', async (req, res, next) => {
    try {
      const [jobs, candidates, campaigns, interests, followUps, outreach, activity] = await Promise.all([
        databasePool.query("SELECT count(*)::integer AS total, count(*) FILTER (WHERE status = 'Active')::integer AS active FROM jobs WHERE workspace_id = $1", [req.workspaceId]),
        databasePool.query('SELECT count(*)::integer AS total FROM candidates WHERE workspace_id = $1 AND discovery_eligible = true', [req.workspaceId]),
        databasePool.query('SELECT count(*)::integer AS total FROM campaigns WHERE workspace_id = $1', [req.workspaceId]),
        databasePool.query('SELECT count(*)::integer AS total FROM candidate_interests WHERE workspace_id = $1', [req.workspaceId]),
        databasePool.query('SELECT count(*)::integer AS total FROM follow_ups WHERE workspace_id = $1 AND completed_at IS NULL', [req.workspaceId]),
        databasePool.query(
          `SELECT count(*) FILTER (WHERE r.status = 'queued')::integer AS queued,
                  count(*) FILTER (WHERE r.status = 'sending')::integer AS sending,
                  count(*) FILTER (WHERE r.status IN ('sent', 'delivered'))::integer AS sent,
                  count(*) FILTER (WHERE r.status = 'unsubscribed')::integer AS unsubscribed
           FROM outreach_recipients r WHERE r.workspace_id = $1`,
          [req.workspaceId],
        ),
        databasePool.query('SELECT id, event_type, entity_type, entity_id, summary, created_at FROM activity_events WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 8', [req.workspaceId]),
      ])
      return res.json({
        counts: {
          jobs: jobs.rows[0].total,
          activeJobs: jobs.rows[0].active,
          candidates: candidates.rows[0].total,
          campaigns: campaigns.rows[0].total,
          interested: interests.rows[0].total,
          followUpsDue: followUps.rows[0].total,
          outreach: outreach.rows[0],
        },
        activity: activity.rows,
      })
    } catch (error) {
      return next(error)
    }
  })

  router.get('/candidates', async (req, res, next) => {
    const parsed = pageOptions(req.query)
    if (!parsed.success) return validationError(res, parsed.error)
    const { q, limit, offset } = parsed.data
    try {
      const result = await databasePool.query(
        `SELECT id, full_name, CASE WHEN outreach_consent THEN email ELSE NULL END AS email,
          role_title, location, experience_years, skills, source, pipeline_status,
          outreach_consent, consent_recorded_at, retention_until, updated_at
         FROM candidates
         WHERE workspace_id = $1 AND discovery_eligible = true
           AND ($2::text IS NULL OR concat_ws(' ', full_name, role_title, location, array_to_string(skills, ' ')) ILIKE '%' || $2 || '%')
         ORDER BY updated_at DESC LIMIT $3 OFFSET $4`,
        [req.workspaceId, q || null, limit, offset],
      )
      return res.json({ candidates: result.rows, limit, offset })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/candidates', async (req, res, next) => {
    const parsed = candidateSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)
    if (!config.candidateRetentionDays) return res.status(503).json({ error: 'Candidate retention policy is not configured. No profile was saved.', code: 'RETENTION_POLICY_NOT_CONFIGURED' })
    const candidate = {
      ...parsed.data,
      email: parsed.data.outreachConsent ? parsed.data.email : null,
    }
    const id = randomUUID()
    let client
    try {
      client = await databasePool.connect()
      await client.query('BEGIN')
      const result = await client.query(
        `INSERT INTO candidates
          (id, workspace_id, full_name, email, role_title, location, experience_years, skills,
           source, discovery_consent, discovery_eligible, outreach_consent, consent_recorded_at, retention_until)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, true, $10, now(), current_date + $11::integer)
         RETURNING id, full_name, CASE WHEN outreach_consent THEN email ELSE NULL END AS email,
                   role_title, location, experience_years, skills, source, outreach_consent,
                   consent_recorded_at, retention_until, updated_at`,
        [id, req.workspaceId, candidate.name, candidate.email, candidate.role, candidate.location,
          candidate.experienceYears ?? null, candidate.skills, candidate.source,
          candidate.outreachConsent, config.candidateRetentionDays],
      )
      await recordActivity(client, {
        workspaceId: req.workspaceId,
        actorId: req.session.userId,
        eventType: 'candidate.created',
        entityType: 'candidate',
        entityId: id,
        summary: 'Added candidate profile with recorded discovery consent',
      })

      await client.query('COMMIT')
      return res.status(201).json({ candidate: result.rows[0] })
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client?.release()
    }
  })

  router.patch('/candidates/:id/status', async (req, res, next) => {
    const id = z.uuid().safeParse(req.params.id)
    const parsed = pipelineStatusSchema.safeParse(req.body)
    if (!id.success || !parsed.success) return res.status(400).json({ error: 'Provide a valid candidate and pipeline status.', code: 'VALIDATION_ERROR' })
    const client = await databasePool.connect().catch(next)
    if (!client) return
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE candidates SET pipeline_status = $1, updated_at = now()
         WHERE id = $2 AND workspace_id = $3 AND discovery_eligible = true
         RETURNING id, pipeline_status`,
        [parsed.data.status, id.data, req.workspaceId],
      )
      if (!result.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Candidate not found in this workspace.', code: 'CANDIDATE_NOT_FOUND' })
      }
      await recordActivity(client, {
        workspaceId: req.workspaceId,
        actorId: req.session.userId,
        eventType: 'candidate.pipeline_status_updated',
        entityType: 'candidate',
        entityId: id.data,
        summary: `Updated candidate pipeline status to ${parsed.data.status}`,
      })
      await client.query('COMMIT')
      return res.json({ candidate: result.rows[0] })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client.release()
    }
  })

  router.get('/candidate-folders', async (req, res, next) => {
    try {
      const result = await databasePool.query(
        `SELECT f.id, f.name, f.created_at, count(m.candidate_id)::integer AS candidate_count
         FROM candidate_folders f
         LEFT JOIN candidate_folder_memberships m ON m.folder_id = f.id
         WHERE f.workspace_id = $1
         GROUP BY f.id
         ORDER BY f.created_at DESC`,
        [req.workspaceId],
      )
      return res.json({ folders: result.rows })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/candidate-folders', async (req, res, next) => {
    const parsed = folderSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)
    try {
      const result = await databasePool.query(
        `INSERT INTO candidate_folders (id, workspace_id, name, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, created_at`,
        [randomUUID(), req.workspaceId, parsed.data.name, req.session.userId],
      )
      return res.status(201).json({ folder: { ...result.rows[0], candidate_count: 0 } })
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A folder with this name already exists.', code: 'FOLDER_EXISTS' })
      return next(error)
    }
  })

  router.post('/candidate-folders/:folderId/candidates/:candidateId', async (req, res, next) => {
    const folderId = z.uuid().safeParse(req.params.folderId)
    const candidateId = z.uuid().safeParse(req.params.candidateId)
    if (!folderId.success || !candidateId.success) return res.status(400).json({ error: 'Provide valid folder and candidate ids.', code: 'VALIDATION_ERROR' })
    try {
      const result = await databasePool.query(
        `INSERT INTO candidate_folder_memberships (folder_id, candidate_id, added_by)
         SELECT f.id, c.id, $3
         FROM candidate_folders f JOIN candidates c ON c.workspace_id = f.workspace_id
         WHERE f.id = $1 AND c.id = $2 AND f.workspace_id = $4 AND c.discovery_eligible = true
         ON CONFLICT DO NOTHING
         RETURNING folder_id, candidate_id`,
        [folderId.data, candidateId.data, req.session.userId, req.workspaceId],
      )
      if (!result.rowCount) return res.status(404).json({ error: 'Folder or candidate not found in this workspace.', code: 'FOLDER_MEMBER_NOT_FOUND' })
      return res.status(201).json({ membership: result.rows[0] })
    } catch (error) {
      return next(error)
    }
  })

  router.get('/outreach-templates', async (req, res, next) => {
    try {
      const result = await databasePool.query(
        `SELECT id, name, subject, body, created_at, updated_at
         FROM outreach_templates WHERE workspace_id = $1 ORDER BY updated_at DESC`,
        [req.workspaceId],
      )
      return res.json({ templates: result.rows })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/outreach-templates', async (req, res, next) => {
    const parsed = templateSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)
    try {
      const result = await databasePool.query(
        `INSERT INTO outreach_templates (id, workspace_id, name, subject, body, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, subject, body, created_at, updated_at`,
        [randomUUID(), req.workspaceId, parsed.data.name, parsed.data.subject, parsed.data.body, req.session.userId],
      )
      return res.status(201).json({ template: result.rows[0] })
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A template with this name already exists.', code: 'TEMPLATE_EXISTS' })
      return next(error)
    }
  })

  router.get('/candidates/:id/notes', async (req, res, next) => {
    const id = z.uuid().safeParse(req.params.id)
    if (!id.success) return res.status(400).json({ error: 'Provide a valid candidate id.', code: 'VALIDATION_ERROR' })
    try {
      const result = await databasePool.query(
        `SELECT n.id, n.body, n.created_at, n.updated_at, u.full_name AS author_name
         FROM candidate_notes n JOIN users u ON u.id = n.author_id
         WHERE n.candidate_id = $1 AND n.workspace_id = $2
         ORDER BY n.created_at DESC`,
        [id.data, req.workspaceId],
      )
      return res.json({ notes: result.rows })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/candidates/:id/notes', async (req, res, next) => {
    const id = z.uuid().safeParse(req.params.id)
    const parsed = noteSchema.safeParse(req.body)
    if (!id.success || !parsed.success) return res.status(400).json({ error: 'Provide a valid candidate and note.', code: 'VALIDATION_ERROR' })
    try {
      const noteId = randomUUID()
      const result = await databasePool.query(
        `INSERT INTO candidate_notes (id, workspace_id, candidate_id, author_id, body)
         SELECT $1, $2, id, $3, $4 FROM candidates
         WHERE id = $5 AND workspace_id = $2 AND discovery_eligible = true
         RETURNING id, candidate_id, body, created_at, updated_at`,
        [noteId, req.workspaceId, req.session.userId, parsed.data.body, id.data],
      )
      if (!result.rowCount) return res.status(404).json({ error: 'Candidate not found in this workspace.', code: 'CANDIDATE_NOT_FOUND' })
      return res.status(201).json({ note: result.rows[0] })
    } catch (error) {
      return next(error)
    }
  })

  router.delete('/candidates/:id', requireWorkspaceRole('owner', 'admin'), async (req, res, next) => {
    const id = z.uuid().safeParse(req.params.id)
    const parsed = candidateDeletionSchema.safeParse(req.body)
    if (!id.success || !parsed.success) {
      return res.status(400).json({
        error: 'A valid candidate id and confirm=true are required to delete a candidate.',
        code: 'DELETION_CONFIRMATION_REQUIRED',
      })
    }
    let client
    try {
      client = await databasePool.connect()
      await client.query('BEGIN')
      const result = await client.query(
        'DELETE FROM candidates WHERE id = $1 AND workspace_id = $2 RETURNING id',
        [id.data, req.workspaceId],
      )
      if (!result.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Candidate not found in this workspace.', code: 'CANDIDATE_NOT_FOUND' })
      }
      await recordActivity(client, {
        workspaceId: req.workspaceId,
        actorId: req.session.userId,
        eventType: 'candidate.deleted',
        entityType: 'candidate',
        entityId: id.data,
        summary: 'Deleted candidate profile after an authorized request',
      })
      await client.query('COMMIT')
      return res.status(204).end()
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client?.release()
    }
  })

  router.get('/interested', async (req, res, next) => {
    const parsed = pageOptions(req.query)
    if (!parsed.success) return validationError(res, parsed.error)
    try {
      const result = await databasePool.query(
        `SELECT i.id, i.status, i.expressed_at, c.id AS candidate_id, c.full_name, c.role_title,
          c.location, c.source AS candidate_source, c.outreach_consent,
          j.id AS job_id, j.title AS job_title
         FROM candidate_interests i
         JOIN candidates c ON c.id = i.candidate_id AND c.workspace_id = i.workspace_id
         LEFT JOIN jobs j ON j.id = i.job_id AND j.workspace_id = i.workspace_id
         WHERE i.workspace_id = $1 AND ($2::text IS NULL OR concat_ws(' ', c.full_name, c.role_title, i.status) ILIKE '%' || $2 || '%')
         ORDER BY i.expressed_at DESC LIMIT $3 OFFSET $4`,
        [req.workspaceId, parsed.data.q || null, parsed.data.limit, parsed.data.offset],
      )
      return res.json({ interests: result.rows, limit: parsed.data.limit, offset: parsed.data.offset })
    } catch (error) {
      return next(error)
    }
  })

  router.patch('/interested/:id/status', async (req, res, next) => {
    const id = z.uuid().safeParse(req.params.id)
    const parsed = interestStatusSchema.safeParse(req.body)
    if (!id.success || !parsed.success) return res.status(400).json({ error: 'Provide a valid interest record and status.', code: 'VALIDATION_ERROR' })
    const client = await databasePool.connect().catch(next)
    if (!client) return
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE candidate_interests SET status = $1
         WHERE id = $2 AND workspace_id = $3 RETURNING id, status, expressed_at`,
        [parsed.data.status, id.data, req.workspaceId],
      )
      if (!result.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Interest record not found in this workspace.', code: 'INTEREST_NOT_FOUND' })
      }
      await recordActivity(client, {
        workspaceId: req.workspaceId,
        actorId: req.session.userId,
        eventType: 'candidate_interest.status_updated',
        entityType: 'candidate_interest',
        entityId: id.data,
        summary: `Updated candidate interest status to ${parsed.data.status}`,
      })
      await client.query('COMMIT')
      return res.json({ interest: result.rows[0] })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client.release()
    }
  })

  router.get('/campaigns', async (req, res, next) => {
    const parsed = pageOptions(req.query)
    if (!parsed.success) return validationError(res, parsed.error)
    try {
      const result = await databasePool.query(
        `SELECT c.id, c.name, c.subject, c.body, c.status, c.recipient_count, c.created_at,
                j.id AS job_id, j.title AS job_title
         FROM campaigns c JOIN jobs j ON j.id = c.job_id AND j.workspace_id = c.workspace_id
         WHERE c.workspace_id = $1 AND ($2::text IS NULL OR concat_ws(' ', c.name, c.subject, c.status) ILIKE '%' || $2 || '%')
         ORDER BY c.created_at DESC LIMIT $3 OFFSET $4`,
        [req.workspaceId, parsed.data.q || null, parsed.data.limit, parsed.data.offset],
      )
      return res.json({ campaigns: result.rows, limit: parsed.data.limit, offset: parsed.data.offset })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/campaigns', async (req, res, next) => {
    const parsed = campaignSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)
    const id = randomUUID()
    const client = await databasePool.connect().catch(next)
    if (!client) return
    try {
      await client.query('BEGIN')
      const job = await client.query('SELECT id FROM jobs WHERE id = $1 AND workspace_id = $2 AND status = $3', [parsed.data.jobId, req.workspaceId, 'Active'])
      if (!job.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Select an active job in this workspace.', code: 'ACTIVE_JOB_REQUIRED' })
      }
      const result = await client.query(
        `INSERT INTO campaigns (id, workspace_id, job_id, created_by, name, subject, body, status, recipient_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Draft', 0)
         RETURNING id, name, subject, body, status, recipient_count, created_at, job_id`,
        [id, req.workspaceId, parsed.data.jobId, req.session.userId, parsed.data.name, parsed.data.subject, parsed.data.body],
      )
      await recordActivity(client, {
        workspaceId: req.workspaceId,
        actorId: req.session.userId,
        eventType: 'campaign.draft_created',
        entityType: 'campaign',
        entityId: id,
        summary: `Created campaign draft: ${parsed.data.name}`,
      })
      await client.query('COMMIT')
      return res.status(201).json({ campaign: result.rows[0], delivery: 'not_sent' })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client.release()
    }
  })

  router.patch('/campaigns/:id', async (req, res, next) => {
    const id = z.uuid().safeParse(req.params.id)
    const parsed = campaignSchema.safeParse(req.body)
    if (!id.success || !parsed.success) return res.status(400).json({ error: 'Provide a valid draft and campaign details.', code: 'VALIDATION_ERROR' })
    const client = await databasePool.connect().catch(next)
    if (!client) return
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE campaigns c
         SET name = $1, job_id = j.id, subject = $2, body = $3, updated_at = now()
         FROM jobs j
         WHERE c.id = $4 AND c.workspace_id = $5 AND c.status = 'Draft'
           AND j.id = $6 AND j.workspace_id = $5 AND j.status = 'Active'
         RETURNING c.id, c.name, c.subject, c.body, c.status, c.recipient_count, c.created_at, c.job_id`,
        [parsed.data.name, parsed.data.subject, parsed.data.body, id.data, req.workspaceId, parsed.data.jobId],
      )
      if (!result.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Draft or active job not found in this workspace.', code: 'DRAFT_NOT_FOUND' })
      }
      await recordActivity(client, {
        workspaceId: req.workspaceId,
        actorId: req.session.userId,
        eventType: 'campaign.draft_updated',
        entityType: 'campaign',
        entityId: id.data,
        summary: `Updated campaign draft: ${parsed.data.name}`,
      })

      await client.query('COMMIT')
      return res.json({ campaign: result.rows[0], delivery: 'not_sent' })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client.release()
    }
  })

  router.get('/campaigns/:id/eligible-recipients', requireWorkspaceRole('owner', 'admin'), async (req, res, next) => {
    const id = z.uuid().safeParse(req.params.id)
    if (!id.success) return res.status(400).json({ error: 'Provide a valid campaign.', code: 'VALIDATION_ERROR' })
    try {
      const result = await databasePool.query(
        `SELECT c.id, c.full_name, c.role_title, c.location, c.outreach_consent
         FROM candidates c
         WHERE c.workspace_id = $1 AND c.discovery_eligible = true
           AND c.outreach_consent = true AND c.consent_recorded_at IS NOT NULL
           AND (c.retention_until IS NULL OR c.retention_until >= current_date)
           AND c.email IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM outreach_unsubscribes u
             WHERE u.workspace_id = c.workspace_id AND lower(u.email) = lower(c.email)
           )
           AND NOT EXISTS (
             SELECT 1 FROM outreach_recipients r
             WHERE r.workspace_id = c.workspace_id AND r.campaign_id = $2 AND r.candidate_id = c.id
           )
         ORDER BY c.full_name, c.id`,
        [req.workspaceId, id.data],
      )
      return res.json({ recipients: result.rows })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/campaigns/:id/queue', requireWorkspaceRole('owner', 'admin'), async (req, res, next) => {
    const id = z.uuid().safeParse(req.params.id)
    const parsed = queueCampaignSchema.safeParse(req.body)
    if (!id.success || !parsed.success) return res.status(400).json({ error: 'Provide a valid campaign and idempotency key.', code: 'VALIDATION_ERROR' })
    let client
    try {
      client = await databasePool.connect()
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`hireflow:campaign-queue:${req.workspaceId}:${id.data}`])
      const campaign = await client.query(
        `SELECT id, status FROM campaigns WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
        [id.data, req.workspaceId],
      )
      if (!campaign.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Campaign not found in this workspace.', code: 'CAMPAIGN_NOT_FOUND' })
      }
      const existingRequest = await client.query(
        'SELECT id FROM campaign_queue_requests WHERE workspace_id = $1 AND campaign_id = $2 AND idempotency_key = $3',
        [req.workspaceId, id.data, parsed.data.idempotencyKey],
      )
      if (existingRequest.rowCount) {
        await client.query('ROLLBACK')
        return res.status(200).json({ queued: true, idempotent: true, delivery: 'not_sent' })
      }
      if (campaign.rows[0].status !== 'Draft') {
        await client.query('ROLLBACK')
        return res.status(409).json({ error: 'Only draft campaigns can be queued.', code: 'CAMPAIGN_STATE_INVALID' })
      }
      const limitCounts = await client.query(
        `SELECT
           (SELECT count(*)::integer FROM campaign_queue_requests WHERE campaign_id = $1 AND created_at >= now() - interval '1 hour') AS campaign_count,
           (SELECT count(*)::integer FROM campaign_queue_requests WHERE workspace_id = $2 AND created_at >= now() - interval '1 hour') AS workspace_count`,
        [id.data, req.workspaceId],
      )
      if (limitCounts.rows[0].campaign_count >= config.campaignQueueLimitPerHour || limitCounts.rows[0].workspace_count >= config.workspaceQueueLimitPerHour) {
        await client.query('ROLLBACK')
        return res.status(429).json({ error: 'Campaign queue rate limit reached. Try again later.', code: 'QUEUE_RATE_LIMITED' })
      }
      const eligibleCandidates = await client.query(
        `SELECT c.id, c.email, c.consent_recorded_at
         FROM candidates c
         WHERE c.workspace_id = $1 AND c.discovery_eligible = true
           AND c.outreach_consent = true AND c.consent_recorded_at IS NOT NULL
           AND (c.retention_until IS NULL OR c.retention_until >= current_date)
           AND c.email IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM outreach_unsubscribes u
             WHERE u.workspace_id = c.workspace_id AND lower(u.email) = lower(c.email)
           )
           AND NOT EXISTS (
             SELECT 1 FROM outreach_recipients r
             WHERE r.workspace_id = c.workspace_id AND r.campaign_id = $2 AND r.candidate_id = c.id
           )
           AND ($3::uuid[] IS NULL OR c.id = ANY($3::uuid[]))
         FOR UPDATE OF c`,
        [req.workspaceId, id.data, parsed.data.candidateIds || null],
      )
      if (!eligibleCandidates.rowCount) {
        await client.query('ROLLBACK')
        return res.status(422).json({ error: 'No eligible consented candidates are available for this campaign.', code: 'NO_ELIGIBLE_RECIPIENTS' })
      }
      await client.query(
        `INSERT INTO campaign_queue_requests (id, workspace_id, campaign_id, idempotency_key, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), req.workspaceId, id.data, parsed.data.idempotencyKey, req.session.userId],
      )
      for (const candidate of eligibleCandidates.rows) {
        await client.query(
          `INSERT INTO outreach_recipients
             (id, workspace_id, campaign_id, candidate_id, email, consent_snapshot, consent_recorded_at, unsubscribe_token_hash, status)
           VALUES ($1, $2, $3, $4, $5, true, $6, $7, 'queued')
           ON CONFLICT (campaign_id, candidate_id) DO NOTHING`,
          [randomUUID(), req.workspaceId, id.data, candidate.id, candidate.email, candidate.consent_recorded_at, createHash('sha256').update(randomUUID().replaceAll('-', '')).digest('hex')],
        )
        await client.query(
          `INSERT INTO outreach_events (id, workspace_id, recipient_id, event_type)
           SELECT gen_random_uuid(), $1, id, 'queued'
           FROM outreach_recipients
           WHERE campaign_id = $2 AND candidate_id = $3`,
          [req.workspaceId, id.data, candidate.id],
        )
      }
      const updatedCampaign = await client.query(
        `UPDATE campaigns SET status = 'Queued', queued_at = now(), queued_by = $1,
          recipient_count = (SELECT count(*)::integer FROM outreach_recipients WHERE campaign_id = $2)
         WHERE id = $2 AND workspace_id = $3 AND status = 'Draft'
         RETURNING id, status, recipient_count, queued_at`,
        [req.session.userId, id.data, req.workspaceId],
      )
      await recordActivity(client, {
        workspaceId: req.workspaceId,
        actorId: req.session.userId,
        eventType: 'campaign.queued',
        entityType: 'campaign',
        entityId: id.data,
        summary: `Queued campaign with ${updatedCampaign.rows[0].recipient_count} consented recipients; delivery is disabled`,
      })
      await client.query('COMMIT')
      return res.status(202).json({ queued: true, idempotent: false, delivery: 'not_sent', campaign: updatedCampaign.rows[0] })
    } catch (error) {
      await client?.query('ROLLBACK').catch(() => {})
      if (error.code === '23505') return res.status(409).json({ error: 'This queue request has already been processed.', code: 'QUEUE_REQUEST_EXISTS' })
      return next(error)
    } finally {
      client?.release()
    }
  })

  router.get('/follow-ups', async (req, res, next) => {
    const parsed = pageOptions(req.query)
    if (!parsed.success) return validationError(res, parsed.error)
    try {
      const result = await databasePool.query(
        `SELECT f.id, f.title, f.due_at, f.completed_at, c.id AS candidate_id,
          c.full_name, c.role_title, c.location, c.experience_years, c.skills,
          c.source AS candidate_source, c.outreach_consent
         FROM follow_ups f JOIN candidates c ON c.id = f.candidate_id AND c.workspace_id = f.workspace_id
         WHERE f.workspace_id = $1 AND ($2::text IS NULL OR concat_ws(' ', f.title, c.full_name, c.role_title) ILIKE '%' || $2 || '%')
         ORDER BY f.due_at ASC LIMIT $3 OFFSET $4`,
        [req.workspaceId, parsed.data.q || null, parsed.data.limit, parsed.data.offset],
      )
      return res.json({ followUps: result.rows, limit: parsed.data.limit, offset: parsed.data.offset })
    } catch (error) {
      return next(error)
    }
  })

  router.post('/follow-ups', async (req, res, next) => {
    const parsed = followUpSchema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)
    const id = randomUUID()
    const client = await databasePool.connect().catch(next)
    if (!client) return
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `INSERT INTO follow_ups (id, workspace_id, candidate_id, assigned_to, title, due_at)
         SELECT $1, $2, c.id, $3, $4, $5
         FROM candidates c WHERE c.id = $6 AND c.workspace_id = $2 AND c.discovery_eligible = true
         RETURNING id, title, due_at, completed_at, candidate_id`,
        [id, req.workspaceId, req.session.userId, parsed.data.title, parsed.data.dueAt, parsed.data.candidateId],
      )
      if (!result.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Candidate not found in this workspace.', code: 'CANDIDATE_NOT_FOUND' })
      }
      await recordActivity(client, {
        workspaceId: req.workspaceId,
        actorId: req.session.userId,
        eventType: 'follow_up.created',
        entityType: 'follow_up',
        entityId: id,
        summary: `Created reminder: ${parsed.data.title}`,
      })
      await client.query('COMMIT')
      return res.status(201).json({ followUp: result.rows[0] })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client.release()
    }
  })

  router.patch('/follow-ups/:id/complete', async (req, res, next) => {
    const id = z.uuid().safeParse(req.params.id)
    if (!id.success) return res.status(400).json({ error: 'Provide a valid reminder id.', code: 'VALIDATION_ERROR' })
    const client = await databasePool.connect().catch(next)
    if (!client) return
    try {
      await client.query('BEGIN')
      const result = await client.query(
        `UPDATE follow_ups SET completed_at = CASE WHEN completed_at IS NULL THEN now() ELSE NULL END,
                              updated_at = now()
         WHERE id = $1 AND workspace_id = $2
         RETURNING id, title, due_at, completed_at`,
        [id.data, req.workspaceId],
      )
      if (!result.rowCount) {
        await client.query('ROLLBACK')
        return res.status(404).json({ error: 'Reminder not found in this workspace.', code: 'FOLLOW_UP_NOT_FOUND' })
      }
      await recordActivity(client, {
        workspaceId: req.workspaceId,
        actorId: req.session.userId,
        eventType: 'follow_up.status_updated',
        entityType: 'follow_up',
        entityId: id.data,
        summary: `${result.rows[0].completed_at ? 'Completed' : 'Reopened'} reminder: ${result.rows[0].title}`,
      })
      await client.query('COMMIT')
      return res.json({ followUp: result.rows[0] })
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      return next(error)
    } finally {
      client.release()
    }
  })

  router.get('/plan-selection', async (req, res, next) => {
    try {
      const result = await databasePool.query(
        'SELECT product_id, billing_interval, selected_at FROM workspace_plan_selections WHERE workspace_id = $1',
        [req.workspaceId],
      )
      return res.json({ selection: result.rows[0] || null, activeSubscription: false })
    } catch (error) {
      return next(error)
    }
  })

  router.put('/plan-selection', requireWorkspaceRole('owner', 'admin'), async (req, res, next) => {
    const schema = z.object({ productId: z.string().min(1).max(80) }).strict()
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return validationError(res, parsed.error)
    const product = productCatalog.find((entry) => entry.id === parsed.data.productId)
    if (!product) return res.status(400).json({ error: 'Select a product in the HireFlow catalog.', code: 'UNKNOWN_PRODUCT' })
    if (product.pricingType === 'custom') return res.status(400).json({ error: 'Enterprise pricing requires an inquiry.', code: 'CUSTOM_PRICING' })
    try {
      await databasePool.query(
        `INSERT INTO workspace_plan_selections (workspace_id, product_id, billing_interval, selected_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id) DO UPDATE
         SET product_id = EXCLUDED.product_id, billing_interval = EXCLUDED.billing_interval,
             selected_by = EXCLUDED.selected_by, selected_at = now()`,
        [req.workspaceId, product.id, product.billingInterval, req.session.userId],
      )
      return res.status(200).json({ selection: { productId: product.id, billingInterval: product.billingInterval }, activeSubscription: false, paymentRequired: true })
    } catch (error) {
      return next(error)
    }
  })

  return router
}