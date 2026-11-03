import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { companyConfig } from './config'
import { Avatar, Button, EmptyState, FormField, Modal, SearchFilter, SectionHeading, StatusBadge } from './components/UI'
import { Icon } from './components/Icon'

const currentDate = new Date()
const today = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ')
const locationKey = (value) => normalizeText(value).toLocaleLowerCase()
const includesQuery = (value, query) => normalizeText(value).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
const builtInCampaignTemplates = [
  {
    id: 'built-in-introduction',
    name: 'Role introduction',
    subject: 'An opportunity that may be a good fit',
    body: 'Hello,\n\nWe came across your profile and thought you may be interested in the {jobTitle} opportunity. Your experience looks relevant to what the team is building.\n\nIf you would like to learn more, reply to this email and we will be happy to share the details.\n\nBest,\nThe hiring team',
  },
  {
    id: 'built-in-follow-up',
    name: 'Friendly follow-up',
    subject: 'Following up about the {jobTitle} opportunity',
    body: 'Hello,\n\nI wanted to follow up on the {jobTitle} opportunity we shared. If the role is relevant to your goals, we would be glad to answer your questions and discuss the next steps.\n\nIf you are not interested, no action is needed.\n\nBest,\nThe hiring team',
  },
  {
    id: 'built-in-interview',
    name: 'Interview invitation',
    subject: 'Next steps for the {jobTitle} opportunity',
    body: 'Hello,\n\nThank you for your interest in the {jobTitle} opportunity. We would like to invite you to the next step in our recruitment process.\n\nPlease reply with a few suitable times, and we will coordinate the details with you.\n\nBest,\nThe hiring team',
  },
]

export function JobsPage({ jobs, setJobs, createJob, updateJob, updateJobStatus, persistenceLabel, search }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState('All jobs')
  const [departmentFilter, setDepartmentFilter] = useState('All departments')
  const [sortOrder, setSortOrder] = useState('newest')
  const showModal = searchParams.get('new') === '1'
  const setShowModal = (open) => {
    const nextParams = new URLSearchParams(searchParams)
    if (open) nextParams.set('new', '1')
    else nextParams.delete('new')
    setSearchParams(nextParams, { replace: !open })
  }
  const [form, setForm] = useState({ title: '', department: '', location: '', type: 'Full-time', skills: '' })
  const [editingJob, setEditingJob] = useState(null)
  const [error, setError] = useState('')
  const [pageError, setPageError] = useState('')
  const [saving, setSaving] = useState(false)
  const departments = [...new Set(jobs.map((job) => job.department))]
  const filtered = jobs.filter((job) => {
    const matchesQuery = !search || [job.title, job.department, job.location, job.type].some((value) => includesQuery(value, search))
    return matchesQuery && (statusFilter === 'All jobs' || job.status === statusFilter) && (departmentFilter === 'All departments' || job.department === departmentFilter)
  }).sort((first, second) => {
    if (sortOrder === 'title-asc') return first.title.localeCompare(second.title)
    if (sortOrder === 'title-desc') return second.title.localeCompare(first.title)
    const firstDate = Date.parse(first.posted) || 0
    const secondDate = Date.parse(second.posted) || 0
    return sortOrder === 'oldest' ? firstDate - secondDate : secondDate - firstDate
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const closeModal = () => {
    setShowModal(false)
    setEditingJob(null)
    setError('')
  }
  const openNewJob = () => {
    setEditingJob(null)
    setForm({ title: '', department: '', location: '', type: 'Full-time', skills: '' })
    setError('')
    setShowModal(true)
  }
  const openEditJob = (job) => {
    setEditingJob(job)
    setForm({ title: job.title, department: job.department, location: job.location, type: job.type, skills: (job.skills || []).join(', ') })
    setError('')
    setShowModal(true)
  }
  const addJob = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.department.trim() || !form.location.trim()) {
      setError('Add a job title, department, and location to continue.')
      return
    }
    setSaving(true)
    const jobDetails = {
      title: form.title.trim(),
      department: form.department.trim(),
      location: form.location.trim(),
      type: form.type,
      skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
      description: editingJob?.description || '',
      preferredSkills: editingJob?.preferredSkills || [],
      workArrangement: editingJob?.workArrangement || 'unspecified',
    }
    const localJob = {
      ...editingJob,
      id: `job-${Date.now()}`, title: form.title.trim(), department: form.department.trim(),
      location: form.location.trim(), type: form.type, status: 'Active', applicants: 0,
      posted: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
    }
    try {
      const savedJob = editingJob ? await updateJob(editingJob.id, jobDetails) : await createJob(jobDetails)
      setJobs((current) => editingJob
        ? current.map((item) => item.id === editingJob.id ? { ...item, ...savedJob } : item)
        : [{ ...localJob, ...savedJob }, ...current.filter((item) => item.id !== savedJob.id)])
      closeModal()
      setError('')
      setForm({ title: '', department: '', location: '', type: 'Full-time', skills: '' })
    } catch (saveError) {
      setError(saveError.message || 'The job could not be saved. Try again.')
    } finally {
      setSaving(false)
    }
  }
  const changeJobStatus = async (job, status) => {
    try {
      const updatedJob = await updateJobStatus(job.id, status)
      setJobs((current) => current.map((item) => item.id === job.id ? { ...item, ...(updatedJob || {}), status } : item))
      setPageError('')
    } catch (statusError) {
      setPageError(statusError.message || 'The job status could not be updated.')
    }
  }

  return (
    <>
      <div className="page-toolbar">
        <div className="toolbar-filters">
          <label className="select-filter"><Icon name="filter" size={16} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by job status"><option>All jobs</option><option>Active</option><option>Paused</option><option>Closed</option></select><Icon name="down" size={14} /></label>
          <label className="select-filter"><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Filter by department"><option>All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select><Icon name="down" size={14} /></label>
          <label className="select-filter"><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort jobs"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title-asc">Title A to Z</option><option value="title-desc">Title Z to A</option></select><Icon name="down" size={14} /></label>
        </div>
        <Button icon="plus" onClick={openNewJob}>Add a job</Button>
      </div>
      {pageError && <p className="form-error" role="alert">{pageError}</p>}
      <div className="jobs-summary">
        <div><span>OPEN ROLES</span><strong>{jobs.filter((job) => job.status === 'Active').length}</strong></div>
        <div><span>TOTAL APPLICANTS</span><strong>{jobs.reduce((total, job) => total + Number(job.applicants || 0), 0)}</strong></div>
        <div><span>DEPARTMENTS</span><strong>{departments.length}</strong></div>
        <div className="summary-illustration"><div className="illustration-mark"><Icon name="briefcase" size={26} /></div><span>Good people<br />start with good roles.</span></div>
      </div>
      <SectionHeading title={`All jobs ${filtered.length}`} detail="A little overview of every role on your team." />
      <div className="panel table-panel">
        {filtered.length ? <div className="table-responsive"><table className="data-table jobs-table">
          <thead><tr><th>JOB TITLE</th><th>STATUS</th><th>DEPARTMENT</th><th>LOCATION</th><th>APPLICANTS</th><th>POSTED</th><th /></tr></thead>
          <tbody>{filtered.map((job, index) => <tr key={job.id}>
            <td><div className="job-title-cell"><span className={`job-symbol job-symbol-${index % 4}`}><Icon name="briefcase" size={16} /></span><div><strong>{job.title}</strong><small>{job.type}</small></div></div></td>
            <td><StatusBadge status={job.status} /></td><td>{job.department}</td><td>{job.location}</td><td><span className="applicant-number">{job.applicants}</span></td><td className="muted-cell">{job.posted}</td>
            <td><div className="job-row-actions"><button className="icon-button row-action" aria-label={`Edit ${job.title}`} onClick={() => openEditJob(job)}><Icon name="edit" /></button><select className={`inline-status status-select-${job.status.toLowerCase()}`} value={job.status} onChange={(event) => changeJobStatus(job, event.target.value)} aria-label={`Update ${job.title} status`}><option>Active</option><option>Paused</option><option>Closed</option></select></div></td>
          </tr>)}</tbody>
        </table></div> : <EmptyState icon="briefcase" title="No roles found" detail="Try a different search or adjust your filters." />}
        <div className="table-footnote">Showing {filtered.length} of {jobs.length} roles <span>{persistenceLabel}</span></div>
      </div>
      {showModal && <Modal title={editingJob ? 'Edit job' : 'Add a new job'} subtitle={editingJob ? 'Update this role in your workspace.' : 'Create a role in your workspace.'} onClose={closeModal}>
        <form onSubmit={addJob} className="modal-form">
          <FormField label="Job title"><input autoFocus value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Product Designer" required /></FormField>
          <div className="form-grid"><FormField label="Department"><input value={form.department} onChange={(event) => update('department', event.target.value)} placeholder="e.g. Design" required /></FormField><FormField label="Location"><input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="e.g. Remote · US" required /></FormField></div>
          <div className="form-grid"><FormField label="Employment type"><select value={form.type} onChange={(event) => update('type', event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></FormField><FormField label="Skills" hint="Optional · Separate skills with commas"><input value={form.skills} onChange={(event) => update('skills', event.target.value)} placeholder="React, Figma, SQL" /></FormField></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><Button variant="secondary" onClick={closeModal} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingJob ? 'Save changes' : 'Create job'}</Button></div>
        </form>
      </Modal>}
    </>
  )
}

function calculateMatch(candidate, job) {
  const required = job.skills || []
  const matchedSkills = required.filter((skill) => candidate.skills.some((candidateSkill) => candidateSkill.toLowerCase() === skill.toLowerCase()))
  const skillPoints = required.length ? (matchedSkills.length / required.length) * 70 : 0
  const rolePoints = candidate.role.toLowerCase().includes(job.title.toLowerCase().split(' ').at(-1)) ? 20 : job.title.toLowerCase().split(' ').some((word) => word.length > 3 && candidate.role.toLowerCase().includes(word)) ? 10 : 0
  const locationPoints = job.location.toLowerCase().includes('remote') || candidate.location.toLowerCase() === job.location.toLowerCase() ? 10 : 0
  return { score: Math.min(100, Math.round(skillPoints + rolePoints + locationPoints)), matchedSkills }
}

export function CandidatesPage({ candidates, setCandidates, createCandidate, updateCandidateStatus, getCandidateNotes, addCandidateNote, getCandidateFolders, createCandidateFolder, addCandidateToFolder, persistenceLabel, jobs, search }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [candidateForm, setCandidateForm] = useState({ name: '', email: '', role: '', location: '', experienceYears: '', skills: '', outreachConsent: false })
  const activeJobs = jobs.filter((job) => job.status === 'Active')
  const [jobId, setJobId] = useState(activeJobs[0]?.id || '')
  const [location, setLocation] = useState('All locations')
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [sortOrder, setSortOrder] = useState('match')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const [candidateNotes, setCandidateNotes] = useState([])
  const [noteDraft, setNoteDraft] = useState('')
  const [profileError, setProfileError] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [folders, setFolders] = useState([])
  const [folderName, setFolderName] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('')
  const [savingFolder, setSavingFolder] = useState(false)
  const currentJob = activeJobs.find((job) => job.id === jobId) || activeJobs[0]
  const locations = [...new Map(
    candidates
      .flatMap((candidate) => normalizeText(candidate.location).split(/\s*(?:,|\||\/)\s*/))
      .filter(Boolean)
      .map((item) => [locationKey(item), item]),
  ).values()].sort((first, second) => first.localeCompare(second))
  const results = candidates.map((candidate) => ({ candidate, match: currentJob ? calculateMatch(candidate, currentJob) : { score: 0, matchedSkills: [] } }))
    .filter(({ candidate }) => {
      const queryMatch = !search || [candidate.name, candidate.role, candidate.location, ...candidate.skills].some((value) => includesQuery(value, search))
      return queryMatch
        && (location === 'All locations' || normalizeText(candidate.location).split(/\s*(?:,|\||\/)\s*/).some((item) => locationKey(item) === locationKey(location)))
        && (statusFilter === 'All statuses' || (candidate.pipelineStatus || 'New') === statusFilter)
    }).sort((a, b) => sortOrder === 'name'
      ? a.candidate.name.localeCompare(b.candidate.name)
      : sortOrder === 'experience'
        ? Number(b.candidate.experienceYears || 0) - Number(a.candidate.experienceYears || 0)
        : b.match.score - a.match.score)
  const updateCandidateForm = (key, value) => {
    setCandidateForm((current) => ({ ...current, [key]: value }))
    setError('')
  }
  const closeCandidateForm = () => {
    setShowAddModal(false)
    setError('')
  }
  const submitCandidate = async (event) => {
    event.preventDefault()
    if (!candidateForm.name.trim() || !candidateForm.role.trim() || !candidateForm.location.trim()) {
      setError('Add the candidate name, role, and location.')
      return
    }
    setSaving(true)
    try {
      const candidate = await createCandidate({
        name: candidateForm.name.trim(),
        email: candidateForm.email.trim(),
        role: candidateForm.role.trim(),
        location: candidateForm.location.trim(),
        experienceYears: candidateForm.experienceYears ? Number(candidateForm.experienceYears) : null,
        skills: candidateForm.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
        outreachConsent: candidateForm.outreachConsent,
      })
      setCandidates((current) => [candidate, ...current])
      setCandidateForm({ name: '', email: '', role: '', location: '', experienceYears: '', skills: '', outreachConsent: false })
      closeCandidateForm()
    } catch (saveError) {
      setError(saveError.message || 'Candidate profile could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const openCandidateProfile = async (candidate) => {
    setSelectedCandidate(candidate)
    setNoteDraft('')
    setSelectedFolder('')
    setProfileError('')
    try {
      const [notes, loadedFolders] = await Promise.all([getCandidateNotes(candidate.id), getCandidateFolders()])
      setCandidateNotes(notes)
      setFolders(loadedFolders)
    } catch (loadError) {
      setProfileError(loadError.message || 'Candidate notes could not be loaded.')
    }
  }
  const changePipelineStatus = async (status) => {
    try {
      const updated = await updateCandidateStatus(selectedCandidate.id, status)
      setSelectedCandidate((current) => ({ ...current, ...updated, pipelineStatus: updated.pipelineStatus || status }))
      setCandidates((current) => current.map((item) => item.id === selectedCandidate.id ? { ...item, ...updated, pipelineStatus: updated.pipelineStatus || status } : item))
      setProfileError('')
    } catch (statusError) {
      setProfileError(statusError.message || 'Candidate status could not be updated.')
    }
  }
  const saveNote = async (event) => {
    event.preventDefault()
    if (!noteDraft.trim()) return
    setSavingNote(true)
    try {
      const note = await addCandidateNote(selectedCandidate.id, noteDraft.trim())
      setCandidateNotes((current) => [note, ...current])
      setNoteDraft('')
      setProfileError('')
    } catch (noteError) {
      setProfileError(noteError.message || 'Candidate note could not be saved.')
    } finally {
      setSavingNote(false)
    }
  }
  const createFolder = async (event) => {
    event.preventDefault()
    if (!folderName.trim()) return
    setSavingFolder(true)
    try {
      const folder = await createCandidateFolder(folderName.trim())
      setFolders((current) => [folder, ...current])
      setFolderName('')
      setProfileError('')
    } catch (folderError) {
      setProfileError(folderError.message || 'Candidate folder could not be created.')
    } finally {
      setSavingFolder(false)
    }
  }
  const assignToFolder = async () => {
    if (!selectedFolder || !selectedCandidate) return
    try {
      await addCandidateToFolder(selectedFolder, selectedCandidate.id)
      setFolders((current) => current.map((folder) => folder.id === selectedFolder
        ? { ...folder, candidate_count: Number(folder.candidate_count || 0) + 1 }
        : folder))
      setProfileError('')
    } catch (folderError) {
      setProfileError(folderError.message || 'Candidate could not be added to the folder.')
    }
  }
  return (
    <>
      <div className="discovery-banner"><div className="discovery-banner-icon"><Icon name="sparkle" size={22} /></div><div><strong>Explainable candidate matching</strong><p>When authorized candidate records are connected, matches are based on listed skills, role keywords, and location fit.</p></div></div>
      <div className="page-toolbar">
        <div className="toolbar-filters"><label className="select-filter"><span className="filter-prefix">For</span><select value={currentJob?.id || ''} onChange={(event) => setJobId(event.target.value)} aria-label="Select job">{activeJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select><Icon name="down" size={14} /></label>
          <label className="select-filter"><Icon name="location" size={16} /><select value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Filter by candidate location"><option>All locations</option>{locations.map((item) => <option key={locationKey(item)} value={item}>{item}</option>)}</select><Icon name="down" size={14} /></label></div>
          <label className="select-filter"><span className="filter-prefix">Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by candidate status"><option>All statuses</option><option>New</option><option>Screening</option><option>Interview</option><option>Offer</option><option>Hired</option><option>Rejected</option></select><Icon name="down" size={14} /></label>
          <label className="select-filter"><span className="filter-prefix">Sort</span><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort candidates"><option value="match">Best match</option><option value="name">Name</option><option value="experience">Experience</option></select><Icon name="down" size={14} /></label>
        <span className="results-count">{results.length} profiles · {persistenceLabel}</span>
        <Button icon="plus" onClick={() => setShowAddModal(true)}>Add consented profile</Button>
      </div>
      <SectionHeading title="Candidates for you" detail={currentJob ? `Matched against ${currentJob.title}` : 'Create an active job to see matching candidates.'} />
      <div className="candidate-grid">
        {results.map(({ candidate, match }) => <article key={candidate.id} className="candidate-card">
          <div className="candidate-card-top"><Avatar candidate={candidate} /></div>
          <h3>{candidate.name}</h3><div className="candidate-role">{candidate.role}</div>
          <div className="candidate-meta"><span><Icon name="location" size={14} />{candidate.location}</span><span><Icon name="briefcase" size={14} />{candidate.experience}</span></div>
          <div className="skill-tags">{candidate.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
          <div className="candidate-source">{candidate.outreachConsent ? 'Outreach consent recorded' : 'Discovery consent recorded'}</div>
          <div className="match-row"><div><span className="match-score">{match.score}%</span><span className="match-caption"> match</span></div><div className="match-meter"><span style={{ width: `${match.score}%` }} /></div></div>
          <div className="match-explainer">{match.matchedSkills.length} of {currentJob?.skills.length || 0} listed skills match</div>
          <button className="candidate-action" onClick={() => openCandidateProfile(candidate)}>View profile <Icon name="arrowRight" size={15} /></button>
        </article>)}
      </div>
      {!results.length && <div className="panel"><EmptyState icon="search" title="No candidate records available" detail="Add a candidate who has consented to recruitment matching, or connect an authorized candidate source." /></div>}
      {selectedCandidate && <Modal title={selectedCandidate.name} subtitle={`${selectedCandidate.role} · ${selectedCandidate.location}`} onClose={() => setSelectedCandidate(null)}>
        <div className="candidate-profile-preview"><div className="candidate-profile-heading"><Avatar candidate={selectedCandidate} /><div><strong>{selectedCandidate.experience} experience</strong><span>Source: {selectedCandidate.source || 'Authorized workspace entry'}</span></div></div>{selectedCandidate.outreachConsent && selectedCandidate.email && <p className="candidate-consent-detail">Email contact consent recorded for {selectedCandidate.email}.</p>}<h3>Pipeline status</h3><select value={selectedCandidate.pipelineStatus || 'New'} onChange={(event) => changePipelineStatus(event.target.value)} aria-label="Candidate pipeline status"><option>New</option><option>Screening</option><option>Interview</option><option>Offer</option><option>Hired</option><option>Rejected</option></select><h3>Folder</h3><form className="inline-form" onSubmit={createFolder}><input value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="New folder name" maxLength={120} aria-label="New candidate folder name" /><Button type="submit" disabled={savingFolder || !folderName.trim()}>{savingFolder ? 'Creating…' : 'Create'}</Button></form><div className="inline-form"><select value={selectedFolder} onChange={(event) => setSelectedFolder(event.target.value)} aria-label="Select candidate folder"><option value="">Select a folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name} · {folder.candidate_count || 0}</option>)}</select><Button type="button" onClick={assignToFolder} disabled={!selectedFolder}>Add</Button></div><h3>Skills</h3><div className="skill-tags">{selectedCandidate.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><h3>Internal notes</h3>{candidateNotes.length ? candidateNotes.map((note) => <p key={note.id} className="candidate-note"><strong>{note.author_name || 'Team member'}</strong><br />{note.body}</p>) : <p className="muted-cell">No internal notes yet.</p>}<form onSubmit={saveNote}><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add an internal recruiter note" maxLength={5000} rows={3} /><Button type="submit" disabled={savingNote || !noteDraft.trim()}>{savingNote ? 'Saving…' : 'Add note'}</Button></form>{profileError && <p className="form-error" role="alert">{profileError}</p>}<div className="modal-actions"><Button onClick={() => setSelectedCandidate(null)}>Done</Button></div></div>
      </Modal>}
      {showAddModal && <Modal title="Add a consented candidate" subtitle="Only add candidate information you are authorized to use." onClose={closeCandidateForm}>
        <form className="modal-form" onSubmit={submitCandidate}>
          <FormField label="Candidate name"><input autoFocus value={candidateForm.name} onChange={(event) => updateCandidateForm('name', event.target.value)} required /></FormField>
          <FormField label="Role or job title"><input value={candidateForm.role} onChange={(event) => updateCandidateForm('role', event.target.value)} required /></FormField>
          <div className="form-grid"><FormField label="Preferred location"><input value={candidateForm.location} onChange={(event) => updateCandidateForm('location', event.target.value)} required /></FormField><FormField label="Experience in years"><input type="number" min="0" max="70" step="0.5" value={candidateForm.experienceYears} onChange={(event) => updateCandidateForm('experienceYears', event.target.value)} /></FormField></div>
          <FormField label="Skills" hint="Optional · Separate skills with commas"><input value={candidateForm.skills} onChange={(event) => updateCandidateForm('skills', event.target.value)} /></FormField>
          <FormField label="Email address" hint="Required only if email outreach consent is separately confirmed"><input type="email" value={candidateForm.email} onChange={(event) => updateCandidateForm('email', event.target.value)} required={candidateForm.outreachConsent} /></FormField>
          <label className="consent-check"><input type="checkbox" required /><span>I confirm the candidate voluntarily supplied this information and agreed to its use for recruitment matching.</span></label>
          <label className="consent-check"><input type="checkbox" checked={candidateForm.outreachConsent} onChange={(event) => updateCandidateForm('outreachConsent', event.target.checked)} /><span>The candidate separately consented to email contact about relevant roles.</span></label>
          <p className="candidate-retention-note">{persistenceLabel.startsWith('In-memory') ? 'Use non-personal test data only in browser mode; profiles are cleared when the app reloads.' : 'A configured retention policy is required before the server will save candidate profiles.'}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><Button variant="secondary" onClick={closeCandidateForm} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save candidate'}</Button></div>
        </form>
      </Modal>}
    </>
  )
}

export function CampaignsPage({ campaigns, setCampaigns, createCampaign, updateCampaign, queueCampaign, getCampaignRecipients, getOutreachTemplates, createOutreachTemplate, persistenceLabel, jobs, search }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const showModal = searchParams.get('new') === '1'
  const setShowModal = (open) => {
    const nextParams = new URLSearchParams(searchParams)
    if (open) nextParams.set('new', '1')
    else nextParams.delete('new')
    setSearchParams(nextParams, { replace: !open })
  }
  const [form, setForm] = useState({ name: '', jobId: jobs.find((job) => job.status === 'Active')?.id || '', subject: '', body: '' })
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [templateSaving, setTemplateSaving] = useState(false)
  const [queueing, setQueueing] = useState('')
  const [recipients, setRecipients] = useState([])
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([])
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  useEffect(() => {
    let active = true
    getOutreachTemplates().then((loadedTemplates) => {
      if (active) setTemplates(loadedTemplates)
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Outreach templates could not be loaded.')
    })
    return () => { active = false }
  }, [getOutreachTemplates])
  const activeJobs = jobs.filter((job) => job.status === 'Active')
  const filtered = campaigns.filter((campaign) => !search || [campaign.name, campaign.subject, campaign.status].some((value) => includesQuery(value, search)))
  const campaignSummary = ['Draft', 'Queued', 'Sending', 'Sent', 'Cancelled'].map((status) => ({ status, count: campaigns.filter((campaign) => campaign.status === status).length }))
  const selectedJob = jobs.find((job) => job.id === form.jobId)
  const canEditPreview = !preview || preview.status === 'Draft'
  const audience = 0
  const closeModal = () => { setShowModal(false); setPreview(null); setError('') }
  const loadRecipients = async (campaign) => {
    if (!campaign?.id || campaign.status !== 'Draft') return
    setLoadingRecipients(true)
    try {
      const loaded = await getCampaignRecipients(campaign.id)
      setRecipients(loaded)
      setSelectedRecipientIds(loaded.map((recipient) => recipient.id))
    } catch (recipientError) {
      setError(recipientError.message || 'Eligible recipients could not be loaded.')
    } finally {
      setLoadingRecipients(false)
    }
  }
  const openModal = () => {
    setForm({ name: '', jobId: activeJobs[0]?.id || '', subject: '', body: '' })
    setSelectedTemplateId('')
    setTemplateName('')
    setError('')
    setShowModal(true)
  }
  const applyTemplate = (templateId) => {
    setSelectedTemplateId(templateId)
    if (templateId === 'manual') {
      setForm((current) => ({ ...current, subject: '', body: '' }))
      return
    }
    const template = [...builtInCampaignTemplates, ...templates].find((item) => item.id === templateId)
    if (!template) return
    const jobTitle = selectedJob?.title || 'the open role'
    setForm((current) => ({
      ...current,
      subject: template.subject.replaceAll('{jobTitle}', jobTitle),
      body: template.body.replaceAll('{jobTitle}', jobTitle),
    }))
    setError('')
  }
  const saveTemplate = async (event) => {
    event.preventDefault()
    if (!templateName.trim() || !form.subject.trim() || !form.body.trim()) {
      setError('Add a template name, subject, and message before saving the template.')
      return
    }
    setTemplateSaving(true)
    try {
      const template = await createOutreachTemplate({ name: templateName.trim(), subject: form.subject.trim(), body: form.body.trim() })
      setTemplates((current) => [template, ...current])
      setTemplateName('')
      setError('')
    } catch (templateError) {
      setError(templateError.message || 'The outreach template could not be saved.')
    } finally {
      setTemplateSaving(false)
    }
  }
  const submitCampaign = async (event) => {
    event.preventDefault()
    if (!form.name.trim() || !form.jobId || !form.subject.trim() || !form.body.trim()) {
      setError('Add a campaign name, related active job, email subject, and message.')
      return
    }
    setSaving(true)
    try {
      if (preview) {
        const updated = await updateCampaign(preview.id, { name: form.name.trim(), jobId: form.jobId, subject: form.subject.trim(), body: form.body.trim() })
        setCampaigns((current) => current.map((item) => item.id === preview.id ? { ...item, ...updated, name: form.name.trim(), jobId: form.jobId, subject: form.subject.trim() } : item))
      } else {
        const draft = { id: `campaign-${Date.now()}`, name: form.name.trim(), jobId: form.jobId, subject: form.subject.trim(), body: form.body.trim(), audience: 0, status: 'Draft', date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) }
        const savedCampaign = await createCampaign({ name: draft.name, jobId: draft.jobId, subject: draft.subject, body: form.body.trim() })
        setCampaigns((current) => [{ ...draft, ...savedCampaign }, ...current])
      }
      closeModal()
      setError('')
    } catch (saveError) {
      setError(saveError.message || 'The campaign draft could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const handleQueue = async (campaign, recipientIds = null) => {
    setQueueing(campaign.id)
    setError('')
    try {
      const queued = await queueCampaign(campaign.id, recipientIds)
      setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, ...queued, status: 'Queued', audience: queued.recipient_count || item.audience } : item))
    } catch (queueError) {
      setError(queueError.message || 'The campaign could not be queued.')
    } finally {
      setQueueing('')
    }
  }
  return (
    <>
      <div className="campaign-callout"><div className="callout-icon"><Icon name="mail" size={19} /></div><div><strong>Review every message before outreach</strong><p>Drafts are saved: {persistenceLabel}. Sending requires a configured server-side email provider and explicit recipient eligibility.</p></div></div>
      <div className="page-toolbar"><div className="toolbar-filters"><span className="results-count">{filtered.length} campaigns</span></div><Button icon="plus" onClick={openModal} disabled={!activeJobs.length}>Create campaign</Button></div>
      <div className="campaign-summary-strip" aria-label="Campaign status summary">{campaignSummary.map((item) => <div key={item.status}><StatusBadge status={item.status} /><strong>{item.count}</strong></div>)}</div>
      {!activeJobs.length && <p className="empty-hint" role="status">Create an active job before starting a campaign.</p>}
      <div className="campaign-grid">
        {filtered.map((campaign, index) => {
          const job = jobs.find((item) => item.id === campaign.jobId)
          return <article className="campaign-card" key={campaign.id}>
            <div className={`campaign-card-art art-${index % 3}`}><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-center"><Icon name={index % 2 ? 'sparkle' : 'send'} size={23} /></div><span className="art-count"><Icon name="users" size={14} />{campaign.audience} people</span></div>
            <div className="campaign-card-content"><div className="campaign-card-status"><StatusBadge status={campaign.status} /><span>{campaign.date}</span></div><h3>{campaign.name}</h3><p>{job?.title || 'Role unavailable'}</p><div className="campaign-subject"><Icon name="mail" size={15} /><span>{campaign.subject}</span></div>
              <button className="campaign-preview-button" onClick={() => { setForm({ name: campaign.name, jobId: campaign.jobId, subject: campaign.subject, body: campaign.body || '' }); setSelectedTemplateId(''); setError(''); setShowModal(true); setPreview(campaign); loadRecipients(campaign) }}>{campaign.status === 'Draft' ? 'Edit draft' : 'View campaign'} <Icon name="arrowRight" size={15} /></button>
              {campaign.status === 'Draft' && <Button variant="secondary" onClick={() => handleQueue(campaign)} disabled={queueing === campaign.id}>{queueing === campaign.id ? 'Queueing…' : 'Queue safely'}</Button>}
            </div>
          </article>
        })}
      </div>
      {!filtered.length && <div className="panel"><EmptyState icon="send" title="No campaigns found" detail="Create a campaign or adjust your search." /></div>}
      {showModal && <Modal wide title={preview ? canEditPreview ? 'Edit campaign draft' : 'Campaign details' : 'Create a campaign'} subtitle={canEditPreview ? 'Review and save an outreach draft.' : 'This campaign is not a draft and cannot be edited here.'} onClose={closeModal}>
        <form className="modal-form campaign-form" onSubmit={submitCampaign}>
          <div className="form-grid"><FormField label="Campaign name"><input autoFocus={!preview} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Design talent — November" required readOnly={!canEditPreview} /></FormField>
            <FormField label="Related job"><select value={form.jobId} onChange={(event) => setForm((current) => ({ ...current, jobId: event.target.value }))} required disabled={!canEditPreview}>{activeJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></FormField></div>
          <FormField label="Email format"><select value={selectedTemplateId} onChange={(event) => applyTemplate(event.target.value)} disabled={!canEditPreview}><option value="">Choose a ready-made format</option><option value="manual">Write manually</option><optgroup label="Built-in formats">{builtInCampaignTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</optgroup>{templates.length > 0 && <optgroup label="Saved workspace templates">{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</optgroup>}</select></FormField>
          <FormField label="Email subject"><input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="A role we thought you'd love" required readOnly={!canEditPreview} /></FormField>
          <FormField label="Message"><textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} placeholder="Write a respectful, consent-based message." rows={5} maxLength={10000} readOnly={!canEditPreview} /></FormField>
          {preview && canEditPreview && <section className="recipient-picker" aria-labelledby="recipient-picker-title"><div className="recipient-picker-heading"><div><h3 id="recipient-picker-title">Eligible recipients</h3><p>Only candidates with current consent, valid retention, and no unsubscribe suppression appear.</p></div><span>{loadingRecipients ? 'Loading…' : `${selectedRecipientIds.length} selected`}</span></div>{!loadingRecipients && recipients.length > 0 && <div className="recipient-picker-list">{recipients.map((recipient) => <label key={recipient.id}><input type="checkbox" checked={selectedRecipientIds.includes(recipient.id)} onChange={(event) => setSelectedRecipientIds((current) => event.target.checked ? [...current, recipient.id] : current.filter((id) => id !== recipient.id))} /><span><strong>{recipient.full_name}</strong><small>{recipient.role_title} · {recipient.location}</small></span></label>)}</div>}{!loadingRecipients && !recipients.length && <p className="muted-cell">No eligible recipients are currently available.</p>}</section>}
          {canEditPreview && <div className="inline-form"><input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="New template name" maxLength={120} aria-label="New outreach template name" /><Button type="button" onClick={saveTemplate} disabled={templateSaving || !templateName.trim()}>{templateSaving ? 'Saving…' : 'Save template'}</Button></div>}
          <div className="email-preview"><div className="email-preview-top"><span><Icon name="mail" size={15} /> EMAIL PREVIEW</span><span className="preview-safe"><span /> DRAFT</span></div><div className="email-preview-body"><p>To: <strong>{audience} eligible candidate profiles</strong></p><p>Subject: <strong>{form.subject || 'Your subject line will appear here'}</strong></p><div className="email-divider" /><p>{form.body || `We thought you might be interested in the ${selectedJob?.title || 'open role'} position at HireFlow.`}</p></div></div>
          <div className="no-send-note"><Icon name="check" size={15} /> {canEditPreview ? `This is a saved draft (${persistenceLabel}).` : 'This campaign is read-only here.'} No email was sent by this interface.</div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><Button variant="secondary" onClick={closeModal} disabled={saving || Boolean(queueing)}>{canEditPreview ? 'Cancel' : 'Close'}</Button>{canEditPreview && <>{preview && <Button type="button" variant="secondary" onClick={() => handleQueue(preview, selectedRecipientIds)} disabled={saving || Boolean(queueing) || loadingRecipients || !selectedRecipientIds.length}>{queueing === preview.id ? 'Queueing…' : 'Queue selected'}</Button>}<Button type="submit" disabled={saving || Boolean(queueing)}>{saving ? 'Saving…' : preview ? 'Save changes' : 'Save as draft'}</Button></>}</div>
        </form>
      </Modal>}
    </>
  )
}

export function InterestedPage({ candidates, jobs, interested, setInterested, updateInterestStatus, search }) {
  const [status, setStatus] = useState('All statuses')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const filtered = interested.filter((item) => {
    const candidate = candidates.find((person) => person.id === item.candidateId) || item.candidate
    if (!candidate) return false
    const matchesSearch = [search, query].filter(Boolean).every((term) => [candidate?.name, candidate?.role, item.status, candidate?.location].some((value) => includesQuery(value || '', term)))
    return matchesSearch && (status === 'All statuses' || item.status === status)
  })
  const updateStatus = async (candidateId, newStatus) => {
    try {
      await updateInterestStatus(candidateId, newStatus)
      setInterested((current) => current.map((item) => item.candidateId === candidateId ? { ...item, status: newStatus } : item))
      setError('')
    } catch (statusError) {
      setError(statusError.message || 'The candidate status could not be updated.')
    }
  }
  return (
    <>
      <div className="interested-banner"><div className="interested-heart"><Icon name="heart" size={22} /></div><div><strong>They raised their hand.</strong><p>Every person here has voluntarily expressed interest in a role. Treat every conversation with care.</p></div><div className="interested-number"><strong>{interested.length}</strong><span>people interested</span></div></div>
      <div className="page-toolbar"><div className="toolbar-filters"><SearchFilter value={query} onChange={setQuery} placeholder="Search interested candidates" /><label className="select-filter"><Icon name="filter" size={16} /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by interest status"><option>All statuses</option><option>New</option><option>Contacted</option><option>In review</option><option>Not interested</option><option>Closed</option></select><Icon name="down" size={14} /></label></div><span className="results-count">{filtered.length} candidates</span></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="panel table-panel">
        {filtered.length ? <div className="table-responsive"><table className="data-table interested-table"><thead><tr><th>CANDIDATE</th><th>ROLE</th><th>INTEREST</th><th>DATE ADDED</th><th>STATUS</th></tr></thead><tbody>
          {filtered.map((item) => {
            const candidate = candidates.find((person) => person.id === item.candidateId) || item.candidate
            const statuses = ['New', 'Contacted', 'In review', 'Not interested', 'Closed']
            const job = jobs.find((entry) => entry.id === item.jobId)
            return candidate && <tr key={item.candidateId}><td><div className="candidate-table-name"><Avatar candidate={candidate} size="small" /><div><strong>{candidate.name}</strong><small>{candidate.location}</small></div></div></td><td>{candidate.role}</td><td><span className="interest-role">{job?.title || 'General interest'}</span></td><td className="muted-cell">{item.date}</td>
              <td><select className={`inline-status status-select-${item.status.toLowerCase().replaceAll(' ', '-')}`} value={item.status} onChange={(event) => updateStatus(item.candidateId, event.target.value)} aria-label={`Update ${candidate.name} status`}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></td></tr>
          })}</tbody></table></div> : <EmptyState icon="heart" title="No interested candidates found" detail="When someone expresses interest, they’ll show up here." />}
        <div className="table-footnote">Showing {filtered.length} of {interested.length} interested candidates <span>Voluntary interest only</span></div>
      </div>
    </>
  )
}

export function FollowUpsPage({ followUps, setFollowUps, createFollowUp, updateFollowUp, persistenceLabel, candidates, search }) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ candidateId: candidates[0]?.id || '', title: '', dueDate: today })
  const [filter, setFilter] = useState('Upcoming')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const list = followUps.filter((item) => {
    const candidate = candidates.find((person) => person.id === item.candidateId)
    const queryMatch = !search || [item.title, candidate?.name, candidate?.role].some((value) => includesQuery(value || '', search))
    const filterMatch = filter === 'All reminders' || (filter === 'Upcoming' && !item.completed) || (filter === 'Completed' && item.completed)
    return queryMatch && filterMatch
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const submitFollowUp = async (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.candidateId || !form.dueDate) {
      setError('Choose a candidate, add a reminder, and set a due date.')
      return
    }
    setSaving(true)
    try {
      const followUp = { ...form, id: `followup-${Date.now()}`, title: form.title.trim(), completed: false }
      const savedFollowUp = await createFollowUp(followUp)
      setFollowUps((current) => [{ ...followUp, ...savedFollowUp }, ...current])
      setShowModal(false)
      setForm({ candidateId: candidates[0]?.id || '', title: '', dueDate: today })
      setError('')
    } catch (saveError) {
      setError(saveError.message || 'The reminder could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const toggleFollowUp = async (item) => {
    try {
      const updated = await updateFollowUp(item)
      setFollowUps((current) => current.map((entry) => entry.id === item.id ? { ...entry, completed: updated?.completed ?? !entry.completed } : entry))
      setError('')
    } catch (updateError) {
      setError(updateError.message || 'The reminder status could not be updated.')
    }
  }
  const overdueCount = followUps.filter((item) => !item.completed && item.dueDate < today).length
  return (
    <>
      <div className="followup-banner"><div className="followup-banner-icon"><Icon name="clock" size={21} /></div><div><strong>Keep candidate conversations moving.</strong><p>Schedule reminders for candidates in your workspace.</p></div><div className="overdue-count"><strong>{overdueCount}</strong><span>overdue</span></div></div>
      <div className="page-toolbar"><div className="toolbar-filters"><label className="select-filter"><Icon name="filter" size={16} /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter reminders"><option>Upcoming</option><option>Completed</option><option>All reminders</option></select><Icon name="down" size={14} /></label><span className="results-count">{list.length} reminders</span></div><Button icon="plus" onClick={() => { setForm((current) => ({ ...current, candidateId: candidates[0]?.id || '' })); setError(''); setShowModal(true) }} disabled={!candidates.length}>New reminder</Button></div>
      {error && !showModal && <p className="form-error" role="alert">{error}</p>}
      <div className="panel followup-list-panel">
        {list.length ? <div className="followup-list">{list.map((item) => {
          const candidate = candidates.find((person) => person.id === item.candidateId) || item.candidate
          const overdue = !item.completed && item.dueDate < today
          return <article className={`followup-item ${item.completed ? 'followup-completed' : ''}`} key={item.id}><button className={`followup-check ${item.completed ? 'checked' : ''}`} onClick={() => toggleFollowUp(item)} aria-label={item.completed ? 'Mark as incomplete' : 'Mark complete'}>{item.completed && <Icon name="check" size={14} />}</button><div className="followup-copy"><strong>{item.title}</strong><span>For {candidate?.name || 'Unknown candidate'} <span className="inline-divider">·</span> {candidate?.role}</span></div><div className={`followup-date ${overdue ? 'is-overdue' : ''}`}><Icon name="calendar" size={15} />{overdue ? 'Overdue · ' : ''}{new Date(`${item.dueDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div><Avatar candidate={candidate || { initials: '?', color: 'indigo' }} size="small" /></article>
        })}</div> : <EmptyState icon="check" title="All caught up" detail={filter === 'Upcoming' ? 'No upcoming reminders. Add one whenever you need a nudge.' : 'No reminders match this view.'} />}
        <div className="table-footnote">Reminders: {persistenceLabel}</div>
      </div>
      {showModal && <Modal title="Create a reminder" subtitle="A little follow-through goes a long way." onClose={() => setShowModal(false)}><form className="modal-form" onSubmit={submitFollowUp}>
        <FormField label="Candidate"><select value={form.candidateId} onChange={(event) => setForm((current) => ({ ...current, candidateId: event.target.value }))} required><option value="">Select a candidate</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.role}</option>)}</select></FormField>
        <FormField label="Reminder"><input autoFocus value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Send a friendly check-in" required /></FormField>
        <FormField label="Due date"><input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} required /></FormField>
        {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create reminder'}</Button></div>
      </form></Modal>}
    </>
  )
}

const initialProfile = { name: '', email: '', role: '', company: '' }
const settingsNav = [
  { id: 'profile', label: 'My profile', icon: 'users' },
  { id: 'workspace', label: 'Workspace', icon: 'briefcase' },
  { id: 'contact', label: 'Contact', icon: 'mail' },
  { id: 'appearance', label: 'Appearance', icon: 'sparkle' },
  { id: 'privacy', label: 'Data & services', icon: 'heart' },
]

export function SettingsPage({ profile, saveProfile, persistenceMode = 'browser', signOut, theme = 'light', onToggleTheme }) {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState(() => window.location.hash.slice(1) || 'profile')
  const [draft, setDraft] = useState(profile || initialProfile)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  useEffect(() => {
    const updateActiveSection = () => setActiveSection(window.location.hash.slice(1) || 'profile')
    window.addEventListener('hashchange', updateActiveSection)
    return () => window.removeEventListener('hashchange', updateActiveSection)
  }, [])
  const initials = draft.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'AC'
  const update = (key, value) => { setSaved(false); setError(''); setDraft((current) => ({ ...current, [key]: value })) }
  const save = async (event) => {
    event.preventDefault()
    if (!draft.name.trim() || !draft.email.trim() || !draft.company.trim()) {
      setError('Add your name, email address, and workspace name to continue.')
      return
    }
    setSaving(true)
    try {
      await saveProfile(draft)
      setSaved(true)
    } catch (saveError) {
      setError(saveError.message || 'Your profile could not be saved. Try again.')
    } finally {
      setSaving(false)
    }
  }
  const logout = async () => {
    if (!signOut) return
    setSigningOut(true)
    setError('')
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (signOutError) {
      setError(signOutError.message || 'You could not be signed out. Try again.')
    } finally {
      setSigningOut(false)
    }
  }
  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">{settingsNav.map((section) => <a key={section.id} className={`settings-nav-item ${activeSection === section.id ? 'active' : ''}`} href={`#${section.id}`} onClick={() => setActiveSection(section.id)}><Icon name={section.icon} size={17} />{section.label}</a>)}</nav>
      <div className="settings-content">
        <form onSubmit={save} className="panel settings-card" id="profile">
          <SectionHeading title="Personal details" detail="The basics about you and your role." />
          <div className="profile-edit-avatar"><div className="avatar avatar-indigo settings-avatar">{initials}</div><div><strong>Account profile</strong><p>{persistenceMode === 'server' ? 'Profile details are saved to your workspace.' : 'Profile details are stored in this browser only.'}</p></div></div>
          <div className="settings-fields"><FormField label="Full name"><input value={draft.name} onChange={(event) => update('name', event.target.value)} required /></FormField><FormField label="Email address" hint={persistenceMode === 'server' ? 'Email changes require a separate verification flow.' : ''}><input type="email" value={draft.email} onChange={(event) => update('email', event.target.value)} required readOnly={persistenceMode === 'server'} /></FormField><FormField label="Role"><input value={draft.role} onChange={(event) => update('role', event.target.value)} /></FormField><FormField label="Workspace name"><input value={draft.company} onChange={(event) => update('company', event.target.value)} required /></FormField></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="settings-save-row">{saved && <span className="saved-message"><Icon name="check" size={15} /> Profile saved successfully.</span>}{signOut && <Button variant="secondary" onClick={logout} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</Button>}<Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></div>
        </form>
        <section className="panel settings-card settings-workspace" id="workspace"><SectionHeading title="Workspace" detail="Workspace information." /><div className="workspace-setting-row"><span className="workspace-avatar settings-workspace-avatar">{(profile.company || companyConfig.workspaceFallback).slice(0, 1).toUpperCase()}</span><div><strong>{profile.company || companyConfig.workspaceFallback}</strong><p>{profile.name ? `Managed by ${profile.name}` : 'Workspace profile not set'}</p></div><Button variant="secondary" onClick={() => document.getElementById('profile')?.scrollIntoView({ behavior: 'smooth' })}>Edit details</Button></div></section>
        <section className="panel settings-card" id="contact"><SectionHeading title="Founder & contact" detail={`Reach ${companyConfig.name}.`} /><div className="contact-details"><p><strong>Founder</strong><span>{companyConfig.founder}</span></p><p><strong>Business</strong><a href={`mailto:${companyConfig.businessEmail}`}>{companyConfig.businessEmail}</a></p><p><strong>Phone</strong><a href={`tel:${companyConfig.phoneLink}`}>{companyConfig.phone}</a></p><p><strong>Personal</strong><a href={`mailto:${companyConfig.personalEmail}`}>{companyConfig.personalEmail}</a></p></div></section>
        <section className="panel settings-card appearance-card" id="appearance"><SectionHeading title="Appearance" detail="Choose the workspace look that feels right for you." /><div className="theme-choice"><div><strong>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</strong><p>Your preference is saved on this device.</p></div><button type="button" className="theme-switch" onClick={onToggleTheme} aria-pressed={theme === 'dark'}><span>{theme === 'dark' ? 'Use light' : 'Use dark'}</span><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} /></button></div></section>
        <section className="panel privacy-card" id="privacy"><div className="privacy-card-icon"><Icon name="heart" size={18} /></div><div><strong>Services, data & payments</strong><p>{persistenceMode === 'browser' ? 'Jobs, campaign drafts, reminders, profile settings, and pricing selections are stored in this browser only.' : 'Workspace profiles and recruitment records are stored by the configured server. Candidate data, subscriptions, and payments remain subject to server configuration and verified integrations.'} Candidate accounts, production consent workflows, email delivery, subscription entitlements, and payment processing require additional configured services.</p><p><a href={`mailto:${companyConfig.businessEmail}?subject=HireFlow%20services%20and%20pricing`}>Contact us about services and pricing</a></p></div></section>
      </div>
    </div>
  )
}
