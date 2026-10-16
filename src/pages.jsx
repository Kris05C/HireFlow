import { useState } from 'react'
import { Avatar, Button, EmptyState, FormField, Modal, SearchFilter, SectionHeading, StatusBadge } from './components/UI'
import { Icon } from './components/Icon'

const today = '2026-10-17'
const includesQuery = (value, query) => value.toLowerCase().includes(query.trim().toLowerCase())

export function JobsPage({ jobs, setJobs, search }) {
  const [statusFilter, setStatusFilter] = useState('All jobs')
  const [departmentFilter, setDepartmentFilter] = useState('All departments')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', department: '', location: '', type: 'Full-time', skills: '' })
  const [error, setError] = useState('')
  const departments = [...new Set(jobs.map((job) => job.department))]
  const filtered = jobs.filter((job) => {
    const matchesQuery = !search || [job.title, job.department, job.location, job.type].some((value) => includesQuery(value, search))
    return matchesQuery && (statusFilter === 'All jobs' || job.status === statusFilter) && (departmentFilter === 'All departments' || job.department === departmentFilter)
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const addJob = (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.department.trim() || !form.location.trim()) {
      setError('Add a job title, department, and location to continue.')
      return
    }
    setJobs((current) => [{
      id: `job-${Date.now()}`, title: form.title.trim(), department: form.department.trim(),
      location: form.location.trim(), type: form.type, status: 'Active', applicants: 0,
      posted: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      skills: form.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
    }, ...current])
    setShowModal(false)
    setError('')
    setForm({ title: '', department: '', location: '', type: 'Full-time', skills: '' })
  }

  return (
    <>
      <div className="page-toolbar">
        <div className="toolbar-filters">
          <label className="select-filter"><Icon name="filter" size={16} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by job status"><option>All jobs</option><option>Active</option><option>Paused</option><option>Closed</option></select><Icon name="down" size={14} /></label>
          <label className="select-filter"><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Filter by department"><option>All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select><Icon name="down" size={14} /></label>
        </div>
        <Button icon="plus" onClick={() => setShowModal(true)}>Add a job</Button>
      </div>
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
            <td><button className="icon-button row-action" aria-label={`More options for ${job.title}`} onClick={() => setJobs((current) => current.map((item) => item.id === job.id ? { ...item, status: item.status === 'Active' ? 'Paused' : 'Active' } : item))}><Icon name="dots" /></button></td>
          </tr>)}</tbody>
        </table></div> : <EmptyState icon="briefcase" title="No roles found" detail="Try a different search or adjust your filters." />}
        <div className="table-footnote">Showing {filtered.length} of {jobs.length} roles <span>Demo job listings</span></div>
      </div>
      {showModal && <Modal title="Add a new job" subtitle="Create a role for your demo workspace." onClose={() => setShowModal(false)}>
        <form onSubmit={addJob} className="modal-form">
          <FormField label="Job title"><input autoFocus value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Product Designer" required /></FormField>
          <div className="form-grid"><FormField label="Department"><input value={form.department} onChange={(event) => update('department', event.target.value)} placeholder="e.g. Design" required /></FormField><FormField label="Location"><input value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="e.g. Remote · US" required /></FormField></div>
          <div className="form-grid"><FormField label="Employment type"><select value={form.type} onChange={(event) => update('type', event.target.value)}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option></select></FormField><FormField label="Skills" hint="Optional · Separate skills with commas"><input value={form.skills} onChange={(event) => update('skills', event.target.value)} placeholder="React, Figma, SQL" /></FormField></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button type="submit">Create job</Button></div>
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

export function CandidatesPage({ candidates, jobs, search }) {
  const activeJobs = jobs.filter((job) => job.status === 'Active')
  const [jobId, setJobId] = useState(activeJobs[0]?.id || '')
  const [location, setLocation] = useState('All locations')
  const [selectedCandidate, setSelectedCandidate] = useState(null)
  const currentJob = activeJobs.find((job) => job.id === jobId) || activeJobs[0]
  const locations = [...new Set(candidates.map((candidate) => candidate.location))]
  const results = candidates.map((candidate) => ({ candidate, match: currentJob ? calculateMatch(candidate, currentJob) : { score: 0, matchedSkills: [] } }))
    .filter(({ candidate }) => {
      const queryMatch = !search || [candidate.name, candidate.role, candidate.location, ...candidate.skills].some((value) => includesQuery(value, search))
      return queryMatch && (location === 'All locations' || candidate.location === location)
    }).sort((a, b) => b.match.score - a.match.score)
  return (
    <>
      <div className="discovery-banner"><div className="discovery-banner-icon"><Icon name="sparkle" size={22} /></div><div><strong>Good matches, no black box.</strong><p>Scores use only skills overlap (70%), role keyword match (20%), and location fit (10%). No personal data or AI ranking.</p></div><span className="banner-demo-label">DEMO MATCHING</span></div>
      <div className="page-toolbar">
        <div className="toolbar-filters"><label className="select-filter"><span className="filter-prefix">For</span><select value={currentJob?.id || ''} onChange={(event) => setJobId(event.target.value)} aria-label="Select job">{activeJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select><Icon name="down" size={14} /></label>
          <label className="select-filter"><Icon name="location" size={16} /><select value={location} onChange={(event) => setLocation(event.target.value)} aria-label="Filter by candidate location"><option>All locations</option>{locations.map((item) => <option key={item}>{item}</option>)}</select><Icon name="down" size={14} /></label></div>
        <span className="results-count">{results.length} demo profiles</span>
      </div>
      <SectionHeading title="Candidates for you" detail={currentJob ? `Matched against ${currentJob.title}` : 'Create an active job to see matching candidates.'} />
      <div className="candidate-grid">
        {results.map(({ candidate, match }) => <article key={candidate.id} className="candidate-card">
          <div className="candidate-card-top"><Avatar candidate={candidate} /></div>
          <h3>{candidate.name}</h3><div className="candidate-role">{candidate.role}</div>
          <div className="candidate-meta"><span><Icon name="location" size={14} />{candidate.location}</span><span><Icon name="briefcase" size={14} />{candidate.experience}</span></div>
          <div className="skill-tags">{candidate.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
          <div className="match-row"><div><span className="match-score">{match.score}%</span><span className="match-caption"> match</span></div><div className="match-meter"><span style={{ width: `${match.score}%` }} /></div></div>
          <div className="match-explainer">{match.matchedSkills.length} of {currentJob?.skills.length || 0} listed skills match</div>
          <button className="candidate-action" onClick={() => setSelectedCandidate(candidate)}>View profile <Icon name="arrowRight" size={15} /></button>
        </article>)}
      </div>
      {!results.length && <div className="panel"><EmptyState icon="search" title="No candidates found" detail="Try another name, skill, role, or location." /></div>}
      {selectedCandidate && <Modal title={selectedCandidate.name} subtitle={`${selectedCandidate.role} · ${selectedCandidate.location}`} onClose={() => setSelectedCandidate(null)}>
        <div className="candidate-profile-preview"><div className="candidate-profile-heading"><Avatar candidate={selectedCandidate} /><div><strong>{selectedCandidate.experience} experience</strong><span>Fictional demo profile · No contact information</span></div></div><h3>Skills</h3><div className="skill-tags">{selectedCandidate.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><p className="profile-demo-note">This profile is fictional and provided for exploring the demo. People can express interest voluntarily; no external profile or contact details are connected.</p><div className="modal-actions"><Button onClick={() => setSelectedCandidate(null)}>Done</Button></div></div>
      </Modal>}
    </>
  )
}

export function CampaignsPage({ campaigns, setCampaigns, jobs, search }) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', jobId: jobs.find((job) => job.status === 'Active')?.id || '', subject: '' })
  const [preview, setPreview] = useState(null)
  const activeJobs = jobs.filter((job) => job.status === 'Active')
  const filtered = campaigns.filter((campaign) => !search || [campaign.name, campaign.subject, campaign.status].some((value) => includesQuery(value, search)))
  const selectedJob = jobs.find((job) => job.id === form.jobId)
  const audience = selectedJob ? 18 + selectedJob.applicants % 15 : 0
  const closeModal = () => { setShowModal(false); setPreview(null) }
  const openModal = () => {
    setForm({ name: '', jobId: activeJobs[0]?.id || '', subject: '' })
    setShowModal(true)
  }
  const submitCampaign = (event, simulateSend) => {
    event.preventDefault()
    if (!form.name.trim() || !form.jobId || !form.subject.trim()) return
    const campaign = { id: `campaign-${Date.now()}`, name: form.name.trim(), jobId: form.jobId, subject: form.subject.trim(), audience, status: simulateSend ? 'Sent' : 'Draft', date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) }
    setCampaigns((current) => [campaign, ...current])
    closeModal()
  }
  return (
    <>
      <div className="campaign-callout"><div className="callout-icon"><Icon name="mail" size={19} /></div><div><strong>Thoughtful outreach starts here</strong><p>Campaigns are for demo purposes only. No emails will be sent.</p></div><span className="callout-no-send"><span /> NO REAL EMAILS</span></div>
      <div className="page-toolbar"><div className="toolbar-filters"><span className="results-count">{filtered.length} campaigns</span></div><Button icon="plus" onClick={openModal} disabled={!activeJobs.length}>Create campaign</Button></div>
      <div className="campaign-grid">
        {filtered.map((campaign, index) => {
          const job = jobs.find((item) => item.id === campaign.jobId)
          return <article className="campaign-card" key={campaign.id}>
            <div className={`campaign-card-art art-${index % 3}`}><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-center"><Icon name={index % 2 ? 'sparkle' : 'send'} size={23} /></div><span className="art-count"><Icon name="users" size={14} />{campaign.audience} people</span></div>
            <div className="campaign-card-content"><div className="campaign-card-status"><StatusBadge status={campaign.status} /><span>{campaign.date}</span></div><h3>{campaign.name}</h3><p>{job?.title || 'Role unavailable'}</p><div className="campaign-subject"><Icon name="mail" size={15} /><span>{campaign.subject}</span></div>
              <button className="campaign-preview-button" onClick={() => { setForm({ name: campaign.name, jobId: campaign.jobId, subject: campaign.subject }); setShowModal(true); setPreview(campaign) }}>{campaign.status === 'Draft' ? 'Review draft' : 'View campaign'} <Icon name="arrowRight" size={15} /></button>
            </div>
          </article>
        })}
      </div>
      {!filtered.length && <div className="panel"><EmptyState icon="send" title="No campaigns found" detail="Create a campaign or adjust your search." /></div>}
      {showModal && <Modal wide title={preview ? 'Campaign preview' : 'Create a campaign'} subtitle="A realistic preview for this demo. Nothing will be emailed." onClose={closeModal}>
        <form className="modal-form campaign-form" onSubmit={(event) => submitCampaign(event, false)}>
          <div className="form-grid"><FormField label="Campaign name"><input autoFocus={!preview} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Design talent — November" required /></FormField>
            <FormField label="Related job"><select value={form.jobId} onChange={(event) => setForm((current) => ({ ...current, jobId: event.target.value }))} required>{activeJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></FormField></div>
          <FormField label="Email subject"><input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="A role we thought you'd love" required /></FormField>
          <div className="email-preview"><div className="email-preview-top"><span><Icon name="mail" size={15} /> EMAIL PREVIEW</span><span className="preview-safe"><span /> PREVIEW ONLY</span></div><div className="email-preview-body"><p>To: <strong>{audience} fictional demo profiles</strong></p><p>Subject: <strong>{form.subject || 'Your subject line will appear here'}</strong></p><div className="email-divider" /><p>Hi there,</p><p>We came across your profile and thought you might be interested in the <strong>{selectedJob?.title || 'open role'}</strong> role at Studio North.</p><p>We’re looking for someone with your experience to help us make thoughtful work. If you’d like to learn more, we’d love to hear from you.</p><p>Warmly,<br />The Studio North team</p></div></div>
          <div className="no-send-note"><Icon name="check" size={15} /> Saving or simulating send only updates this local demo. No emails or personal contact details are used.</div>
          <div className="modal-actions"><Button variant="secondary" onClick={closeModal}>Cancel</Button><Button type="submit" variant="secondary">Save as draft</Button><Button type="button" icon="send" onClick={(event) => submitCampaign(event, true)}>Simulate sending</Button></div>
        </form>
      </Modal>}
    </>
  )
}

export function InterestedPage({ candidates, jobs, interested, setInterested, search }) {
  const [status, setStatus] = useState('All statuses')
  const [query, setQuery] = useState('')
  const filtered = interested.filter((item) => {
    const candidate = candidates.find((person) => person.id === item.candidateId)
    const matchesSearch = [search, query].filter(Boolean).every((term) => [candidate?.name, candidate?.role, item.status, candidate?.location].some((value) => includesQuery(value || '', term)))
    return matchesSearch && (status === 'All statuses' || item.status === status)
  })
  const updateStatus = (candidateId, newStatus) => setInterested((current) => current.map((item) => item.candidateId === candidateId ? { ...item, status: newStatus } : item))
  return (
    <>
      <div className="interested-banner"><div className="interested-heart"><Icon name="heart" size={22} /></div><div><strong>They raised their hand.</strong><p>Every person here has voluntarily expressed interest in a role. Treat every conversation with care.</p></div><div className="interested-number"><strong>{interested.length}</strong><span>people interested</span></div></div>
      <div className="page-toolbar"><div className="toolbar-filters"><SearchFilter value={query} onChange={setQuery} placeholder="Search interested candidates" /><label className="select-filter"><Icon name="filter" size={16} /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by interest status"><option>All statuses</option><option>New</option><option>Contacted</option><option>In review</option></select><Icon name="down" size={14} /></label></div><span className="results-count">{filtered.length} candidates</span></div>
      <div className="panel table-panel">
        {filtered.length ? <div className="table-responsive"><table className="data-table interested-table"><thead><tr><th>CANDIDATE</th><th>ROLE</th><th>INTEREST</th><th>DATE ADDED</th><th>STATUS</th></tr></thead><tbody>
          {filtered.map((item) => {
            const candidate = candidates.find((person) => person.id === item.candidateId)
            const statuses = ['New', 'Contacted', 'In review']
            const job = jobs.find((entry) => entry.id === item.jobId)
            return candidate && <tr key={item.candidateId}><td><div className="candidate-table-name"><Avatar candidate={candidate} size="small" /><div><strong>{candidate.name}</strong><small>{candidate.location}</small></div></div></td><td>{candidate.role}</td><td><span className="interest-role">{job?.title || 'General interest'}</span></td><td className="muted-cell">{item.date}</td>
              <td><select className={`inline-status status-select-${item.status.toLowerCase().replaceAll(' ', '-')}`} value={item.status} onChange={(event) => updateStatus(item.candidateId, event.target.value)} aria-label={`Update ${candidate.name} status`}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></td></tr>
          })}</tbody></table></div> : <EmptyState icon="heart" title="No interested candidates found" detail="When someone expresses interest, they’ll show up here." />}
        <div className="table-footnote">Showing {filtered.length} of {interested.length} interested candidates <span>Voluntary interest only</span></div>
      </div>
    </>
  )
}

export function FollowUpsPage({ followUps, setFollowUps, candidates, search }) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ candidateId: candidates[0]?.id || '', title: '', dueDate: today })
  const [filter, setFilter] = useState('Upcoming')
  const [error, setError] = useState('')
  const list = followUps.filter((item) => {
    const candidate = candidates.find((person) => person.id === item.candidateId)
    const queryMatch = !search || [item.title, candidate?.name, candidate?.role].some((value) => includesQuery(value || '', search))
    const filterMatch = filter === 'All reminders' || (filter === 'Upcoming' && !item.completed) || (filter === 'Completed' && item.completed)
    return queryMatch && filterMatch
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const createFollowUp = (event) => {
    event.preventDefault()
    if (!form.title.trim() || !form.candidateId || !form.dueDate) {
      setError('Choose a candidate, add a reminder, and set a due date.')
      return
    }
    setFollowUps((current) => [{ ...form, id: `followup-${Date.now()}`, title: form.title.trim(), completed: false }, ...current])
    setShowModal(false)
    setForm({ candidateId: candidates[0]?.id || '', title: '', dueDate: today })
    setError('')
  }
  const overdueCount = followUps.filter((item) => !item.completed && item.dueDate < today).length
  return (
    <>
      <div className="followup-banner"><div className="followup-banner-icon"><Icon name="clock" size={21} /></div><div><strong>A small nudge goes a long way.</strong><p>Stay on top of candidate conversations and keep your next step in sight.</p></div><div className="overdue-count"><strong>{overdueCount}</strong><span>overdue</span></div></div>
      <div className="page-toolbar"><div className="toolbar-filters"><label className="select-filter"><Icon name="filter" size={16} /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter reminders"><option>Upcoming</option><option>Completed</option><option>All reminders</option></select><Icon name="down" size={14} /></label><span className="results-count">{list.length} reminders</span></div><Button icon="plus" onClick={() => setShowModal(true)}>New reminder</Button></div>
      <div className="panel followup-list-panel">
        {list.length ? <div className="followup-list">{list.map((item) => {
          const candidate = candidates.find((person) => person.id === item.candidateId)
          const overdue = !item.completed && item.dueDate < today
          return <article className={`followup-item ${item.completed ? 'followup-completed' : ''}`} key={item.id}><button className={`followup-check ${item.completed ? 'checked' : ''}`} onClick={() => setFollowUps((current) => current.map((entry) => entry.id === item.id ? { ...entry, completed: !entry.completed } : entry))} aria-label={item.completed ? 'Mark as incomplete' : 'Mark complete'}>{item.completed && <Icon name="check" size={14} />}</button><div className="followup-copy"><strong>{item.title}</strong><span>For {candidate?.name || 'Unknown candidate'} <span className="inline-divider">·</span> {candidate?.role}</span></div><div className={`followup-date ${overdue ? 'is-overdue' : ''}`}><Icon name="calendar" size={15} />{overdue ? 'Overdue · ' : ''}{new Date(`${item.dueDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div><Avatar candidate={candidate || { initials: '?', color: 'indigo' }} size="small" /></article>
        })}</div> : <EmptyState icon="check" title="All caught up" detail={filter === 'Upcoming' ? 'No upcoming reminders. Add one whenever you need a nudge.' : 'No reminders match this view.'} />}
        <div className="table-footnote">Your reminders are saved in this browser <span>Private demo data</span></div>
      </div>
      {showModal && <Modal title="Create a reminder" subtitle="A little follow-through goes a long way." onClose={() => setShowModal(false)}><form className="modal-form" onSubmit={createFollowUp}>
        <FormField label="Candidate"><select value={form.candidateId} onChange={(event) => setForm((current) => ({ ...current, candidateId: event.target.value }))}>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.role}</option>)}</select></FormField>
        <FormField label="Reminder"><input autoFocus value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Send a friendly check-in" required /></FormField>
        <FormField label="Due date"><input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} required /></FormField>
        {error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button><Button type="submit">Create reminder</Button></div>
      </form></Modal>}
    </>
  )
}

const initialProfile = { name: 'Krishna Chaurasiya', email: 'Charasiyakrishn05@gmail.com', role: 'AI Engineer', company: 'Studio North', timezone: 'Eastern Time (US & Canada)' }

export function SettingsPage() {
  const [profile, setProfile] = useState(() => {
    try { return { ...initialProfile, ...JSON.parse(localStorage.getItem('hireflow-profile') || '{}') } }
    catch (error) { console.error('Could not read demo profile from local storage', error); return initialProfile }
  })
  const [saved, setSaved] = useState(false)
  const update = (key, value) => { setSaved(false); setProfile((current) => ({ ...current, [key]: value })) }
  const save = (event) => {
    event.preventDefault()
    if (!profile.name.trim() || !profile.email.trim() || !profile.company.trim()) return
    localStorage.setItem('hireflow-profile', JSON.stringify(profile))
    setSaved(true)
  }
  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections"><a className="settings-nav-item active" href="#profile"><Icon name="users" size={17} />My profile</a><a className="settings-nav-item" href="#workspace"><Icon name="briefcase" size={17} />Workspace</a><a className="settings-nav-item" href="#privacy"><Icon name="heart" size={17} />Privacy & demo</a></nav>
      <div className="settings-content">
        <form onSubmit={save} className="panel settings-card" id="profile">
          <SectionHeading title="Personal details" detail="The basics about you and your role." />
          <div className="profile-edit-avatar"><div className="avatar avatar-indigo settings-avatar">AM</div><div><strong>Profile photo</strong><p>Initials are used in this demo workspace.</p></div></div>
          <div className="settings-fields"><FormField label="Full name"><input value={profile.name} onChange={(event) => update('name', event.target.value)} required /></FormField><FormField label="Email address" hint="Fictional demo address"><input type="email" value={profile.email} onChange={(event) => update('email', event.target.value)} required /></FormField><FormField label="Job title"><input value={profile.role} onChange={(event) => update('role', event.target.value)} /></FormField></div>
          <div className="settings-save-row">{saved && <span className="saved-message"><Icon name="check" size={15} /> Your profile is saved in this browser.</span>}<Button type="submit">Save changes</Button></div>
        </form>
        <section className="panel settings-card settings-workspace" id="workspace"><SectionHeading title="Workspace" detail="Your team’s demo hiring space." /><div className="workspace-setting-row"><span className="workspace-avatar settings-workspace-avatar">S</span><div><strong>{profile.company}</strong><p>Free demo workspace · Created for exploring HireFlow</p></div><Button variant="secondary" onClick={() => document.getElementById('profile')?.scrollIntoView({ behavior: 'smooth' })}>Edit details</Button></div></section>
        <section className="panel privacy-card" id="privacy"><div className="privacy-card-icon"><Icon name="heart" size={18} /></div><div><strong>Privacy-first demo</strong><p>HireFlow uses fictional profiles, made-up data, and local browser storage only. No real candidate details are collected; no backend, database, or email service is connected.</p></div><span className="privacy-label">DEMO MODE</span></section>
      </div>
    </div>
  )
}
