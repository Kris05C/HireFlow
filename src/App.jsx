import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/context'
import { apiRequest } from './api/client'
import { companyConfig } from './config'
import { AppLayout } from './components/Layout'
import { AuthPage } from './pages/AuthPage'
import { PricingPage } from './pages/Pricing'
import { CampaignsPage, CandidatesPage, FollowUpsPage, InterestedPage, JobsPage, SettingsPage } from './pages'
import Dashboard from './pages/Dashboard'
import './App.css'
import './responsive.css'

const sampleIds = {
  'hireflow-jobs': new Set(['job-1', 'job-2', 'job-3', 'job-4', 'job-5', 'job-6', 'job-7']),
  'hireflow-campaigns': new Set(['campaign-1', 'campaign-2']),
  'hireflow-followups': new Set(['followup-1', 'followup-2', 'followup-3', 'followup-4']),
  'hireflow-interested': new Set(['candidate-1', 'candidate-2', 'candidate-3', 'candidate-5', 'candidate-7']),
}

const readStored = (key) => {
  try {
    const stored = localStorage.getItem(key)
    const value = stored ? JSON.parse(stored) : []
    if (!Array.isArray(value)) return []
    const idsToRemove = sampleIds[key]
    if (!idsToRemove) return value
    const cleaned = value.filter((item) => !idsToRemove.has(item.id ?? item.candidateId))
    if (cleaned.length !== value.length) localStorage.setItem(key, JSON.stringify(cleaned))
    return cleaned
  } catch (error) {
    console.error(`Could not read ${key} from local storage`, error)
    return []
  }
}

const readProfile = () => {
  try {
    const stored = JSON.parse(localStorage.getItem('hireflow-profile') || '{}')
    return {
      name: stored.name || '',
      email: stored.email || '',
      role: stored.role || '',
      company: stored.company === 'Studio North' ? companyConfig.name : stored.company || '',
    }
  } catch (error) {
    console.error('Could not read profile from local storage', error)
    return { name: '', email: '', role: '', company: '' }
  }
}

const emptyProfile = { name: '', email: '', role: '', company: '' }
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : ''
const formatDateOnly = (value) => (value instanceof Date ? value : new Date(value)).toISOString().slice(0, 10)
const mapJob = (job) => ({ ...job, posted: formatDate(job.posted), applicants: Number(job.applicants || 0) })
const mapCandidate = (candidate) => {
  const name = candidate.full_name || ''
  return {
    id: candidate.id,
    name,
    initials: name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'AC',
    role: candidate.role_title || '',
    location: candidate.location || '',
    experience: candidate.experience_years ? `${candidate.experience_years} years` : 'Not provided',
    skills: candidate.skills || [],
    color: 'blue',
    source: candidate.source || 'candidate-consented-recruiter-entry',
    outreachConsent: Boolean(candidate.outreach_consent),
    retentionUntil: candidate.retention_until || null,
  }
}
const mapCampaign = (campaign) => ({
  id: campaign.id,
  name: campaign.name,
  jobId: campaign.job_id,
  subject: campaign.subject,
  status: campaign.status,
  audience: campaign.recipient_count || 0,
  date: formatDate(campaign.created_at),
})
const mapInterest = (interest) => ({
  id: interest.id,
  candidateId: interest.candidate_id,
  jobId: interest.job_id,
  status: interest.status,
  date: formatDate(interest.expressed_at),
  candidate: mapCandidate({
    id: interest.candidate_id,
    full_name: interest.full_name,
    role_title: interest.role_title,
    location: interest.location,
    source: interest.candidate_source,
    outreach_consent: interest.outreach_consent,
  }),
})
const mapFollowUp = (item) => ({
  id: item.id,
  candidateId: item.candidate_id,
  title: item.title,
  dueDate: formatDateOnly(item.due_at),
  completed: Boolean(item.completed_at),
  candidate: mapCandidate({
    id: item.candidate_id,
    full_name: item.full_name,
    role_title: item.role_title,
    location: item.location,
    experience_years: item.experience_years,
    skills: item.skills,
    source: item.candidate_source,
    outreach_consent: item.outreach_consent,
  }),
})

const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.error(`Could not save ${key} in this browser`, error)
    return false
  }
}

function RoutedApp() {
  const location = useLocation()
  const auth = useAuth()
  const [localProfile, setLocalProfile] = useState(readProfile)
  const profile = auth.authRequired ? auth.profile || emptyProfile : localProfile
  const [jobs, setJobs] = useState(() => auth.authRequired ? [] : readStored('hireflow-jobs'))
  const [campaigns, setCampaigns] = useState(() => auth.authRequired ? [] : readStored('hireflow-campaigns'))
  const [followUps, setFollowUps] = useState(() => auth.authRequired ? [] : readStored('hireflow-followups'))
  const [interested, setInterested] = useState(() => auth.authRequired ? [] : readStored('hireflow-interested'))
  const [candidates, setCandidates] = useState([])
  const [activity, setActivity] = useState(() => auth.authRequired ? [] : readStored('hireflow-activity'))
  const [serverCounts, setServerCounts] = useState(null)
  const [planSelection, setPlanSelection] = useState('')
  const [dataStatus, setDataStatus] = useState(() => auth.authRequired ? 'loading' : 'local')
  const [dataError, setDataError] = useState('')
  const [loadRevision, setLoadRevision] = useState(0)
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!auth.authRequired || auth.status !== 'authenticated') return undefined
    let active = true
    Promise.all([
      apiRequest('/jobs'),
      apiRequest('/candidates'),
      apiRequest('/workspace/campaigns'),
      apiRequest('/workspace/interested'),
      apiRequest('/workspace/follow-ups'),
      apiRequest('/workspace/dashboard'),
      apiRequest('/workspace/plan-selection'),
    ]).then(([jobData, candidateData, campaignData, interestData, followUpData, dashboardData, planData]) => {
      if (!active) return
      setJobs(jobData.jobs.map(mapJob))
      setCandidates(candidateData.candidates.map(mapCandidate))
      setCampaigns(campaignData.campaigns.map(mapCampaign))
      setInterested(interestData.interests.map(mapInterest))
      setFollowUps(followUpData.followUps.map(mapFollowUp))
      setActivity(dashboardData.activity)
      setServerCounts(dashboardData.counts)
      setPlanSelection(planData.selection?.product_id || '')
      setDataError('')
      setDataStatus('ready')
    }).catch((error) => {
      if (!active) return
      setDataError(error.message || 'Workspace data could not be loaded.')
      setDataStatus('error')
    })
    return () => { active = false }
  }, [auth.authRequired, auth.status, loadRevision])

  useEffect(() => {
    if (!auth.authRequired) writeStored('hireflow-jobs', jobs)
  }, [auth.authRequired, jobs])
  useEffect(() => {
    if (!auth.authRequired) writeStored('hireflow-campaigns', campaigns)
  }, [auth.authRequired, campaigns])
  useEffect(() => {
    if (!auth.authRequired) writeStored('hireflow-interested', interested)
  }, [auth.authRequired, interested])
  useEffect(() => {
    if (!auth.authRequired) writeStored('hireflow-activity', activity)
  }, [auth.authRequired, activity])

  const recordLocalActivity = (eventType, summary, entityType = 'workspace') => {
    if (auth.authRequired) return
    setActivity((current) => [{
      id: `activity-${Date.now()}`,
      event_type: eventType,
      entity_type: entityType,
      summary,
      created_at: new Date().toISOString(),
    }, ...current].slice(0, 50))
  }
  const refreshServerDashboard = async () => {
    try {
      const result = await apiRequest('/workspace/dashboard')
      setServerCounts(result.counts)
      setActivity(result.activity)
    } catch {
      setDataError('The operation succeeded, but dashboard totals could not be refreshed.')
    }
  }

  const createJob = async (job) => {
    if (!auth.authRequired) {
      const nextJobs = [job, ...jobs]
      if (!writeStored('hireflow-jobs', nextJobs)) throw new Error('Job could not be saved in this browser. Check available storage and retry.')
      recordLocalActivity('job.created', `Created job: ${job.title}`, 'job')
      return job
    }
    const result = await apiRequest('/jobs', {
      method: 'POST',
      body: {
        title: job.title,
        department: job.department,
        location: job.location,
        type: job.type,
        skills: job.skills,
        description: job.description || '',
        preferredSkills: job.preferredSkills || [],
        workArrangement: job.workArrangement || 'unspecified',
      },
    })
    await refreshServerDashboard()
    return mapJob(result.job)
  }
  const updateJob = async (jobId, job) => {
    if (!auth.authRequired) {
      const nextJobs = jobs.map((item) => item.id === jobId ? { ...item, ...job } : item)
      if (!writeStored('hireflow-jobs', nextJobs)) throw new Error('Job changes could not be saved in this browser.')
      recordLocalActivity('job.updated', `Updated job: ${job.title}`, 'job')
      return nextJobs.find((item) => item.id === jobId)
    }
    const result = await apiRequest(`/jobs/${jobId}`, { method: 'PATCH', body: job })
    await refreshServerDashboard()
    return mapJob(result.job)
  }
  const updateJobStatus = async (jobId, status) => {
    if (!auth.authRequired) {
      const job = jobs.find((item) => item.id === jobId)
      const nextJobs = jobs.map((item) => item.id === jobId ? { ...item, status } : item)
      if (!writeStored('hireflow-jobs', nextJobs)) throw new Error('Job status could not be saved in this browser.')
      recordLocalActivity('job.status_updated', `Updated ${job?.title || 'job'} status to ${status}`, 'job')
      return nextJobs.find((item) => item.id === jobId)
    }
    const result = await apiRequest(`/jobs/${jobId}/status`, { method: 'PATCH', body: { status } })
    await refreshServerDashboard()
    return mapJob(result.job)
  }
  const createCandidate = async (candidate) => {
    if (!auth.authRequired) {
      const savedCandidate = {
        ...candidate,
        id: `candidate-${Date.now()}`,
        email: candidate.outreachConsent ? candidate.email : '',
        initials: candidate.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'AC',
        experience: candidate.experienceYears ? `${candidate.experienceYears} years` : 'Not provided',
        color: 'blue',
        source: 'candidate-consented-recruiter-entry',
        outreachConsent: Boolean(candidate.outreachConsent),
      }
      recordLocalActivity('candidate.created', 'Added candidate profile with recorded discovery consent', 'candidate')
      return savedCandidate
    }
    const result = await apiRequest('/workspace/candidates', {
      method: 'POST',
      body: {
        name: candidate.name,
        email: candidate.outreachConsent ? candidate.email : '',
        role: candidate.role,
        location: candidate.location,
        experienceYears: candidate.experienceYears,
        skills: candidate.skills,
        source: 'candidate-consented-recruiter-entry',
        discoveryConsent: true,
        outreachConsent: Boolean(candidate.outreachConsent),
      },
    })
    await refreshServerDashboard()
    return mapCandidate(result.candidate)
  }
  const createCampaign = async (campaign) => {
    if (!auth.authRequired) {
      const savedCampaign = { ...campaign, id: campaign.id || `campaign-${Date.now()}` }
      if (!writeStored('hireflow-campaigns', [savedCampaign, ...campaigns])) throw new Error('Campaign draft could not be saved in this browser.')
      recordLocalActivity('campaign.draft_created', `Created campaign draft: ${campaign.name}`, 'campaign')
      return savedCampaign
    }
    const result = await apiRequest('/workspace/campaigns', { method: 'POST', body: campaign })
    await refreshServerDashboard()
    return mapCampaign(result.campaign)
  }
  const updateCampaign = async (campaignId, campaign) => {
    if (!auth.authRequired) {
      const nextCampaigns = campaigns.map((item) => item.id === campaignId ? { ...item, ...campaign } : item)
      if (!writeStored('hireflow-campaigns', nextCampaigns)) throw new Error('Campaign changes could not be saved in this browser.')
      recordLocalActivity('campaign.draft_updated', `Updated campaign draft: ${campaign.name}`, 'campaign')
      return nextCampaigns.find((item) => item.id === campaignId)
    }
    const result = await apiRequest(`/workspace/campaigns/${campaignId}`, { method: 'PATCH', body: campaign })
    await refreshServerDashboard()
    return mapCampaign(result.campaign)
  }
  const createFollowUp = async (followUp) => {
    if (!auth.authRequired) {
      recordLocalActivity('follow_up.created', `Created reminder: ${followUp.title}`, 'follow_up')
      return followUp
    }
    const result = await apiRequest('/workspace/follow-ups', {
      method: 'POST',
      body: { candidateId: followUp.candidateId, title: followUp.title, dueAt: `${followUp.dueDate}T12:00:00.000Z` },
    })
    await refreshServerDashboard()
    return mapFollowUp(result.followUp)
  }
  const updateFollowUp = async (followUp) => {
    if (!auth.authRequired) {
      const nextFollowUps = followUps.map((item) => item.id === followUp.id ? { ...item, completed: !item.completed } : item)
      recordLocalActivity('follow_up.completed', `${followUp.completed ? 'Reopened' : 'Completed'} reminder: ${followUp.title}`, 'follow_up')
      return nextFollowUps.find((item) => item.id === followUp.id)
    }
    const result = await apiRequest(`/workspace/follow-ups/${followUp.id}/complete`, { method: 'PATCH' })
    await refreshServerDashboard()
    return mapFollowUp(result.followUp)
  }
  const updateInterestStatus = async (candidateId, status) => {
    if (!auth.authRequired) {
      const nextInterests = interested.map((item) => item.candidateId === candidateId ? { ...item, status } : item)
      if (!writeStored('hireflow-interested', nextInterests)) throw new Error('Candidate status could not be saved in this browser.')
      recordLocalActivity('candidate_interest.status_updated', `Updated candidate interest status to ${status}`, 'candidate_interest')
      return nextInterests.find((item) => item.candidateId === candidateId)
    }
    const interest = interested.find((item) => item.candidateId === candidateId)
    if (!interest?.id) throw new Error('This candidate interest cannot be updated from the available records.')
    const result = await apiRequest(`/workspace/interested/${interest.id}/status`, { method: 'PATCH', body: { status } })
    await refreshServerDashboard()
    return result.interest
  }
  const saveProfile = async (nextProfile) => {
    if (auth.authRequired) return auth.saveProfile(nextProfile)
    if (!writeStored('hireflow-profile', nextProfile)) throw new Error('Profile could not be saved in this browser.')
    setLocalProfile(nextProfile)
    return nextProfile
  }
  const selectPlan = async (productId) => {
    if (!auth.authRequired) return
    const result = await apiRequest('/workspace/plan-selection', { method: 'PUT', body: { productId } })
    setPlanSelection(result.selection.productId)
  }
  const dashboardCounts = auth.authRequired && serverCounts ? serverCounts : {
    jobs: jobs.length,
    activeJobs: jobs.filter((job) => job.status === 'Active').length,
    candidates: candidates.length,
    campaigns: campaigns.length,
    interested: interested.length,
    followUpsDue: followUps.filter((item) => !item.completed).length,
  }
  const counts = {
    candidateCount: dashboardCounts.candidates,
    activeJobs: dashboardCounts.activeJobs,
    campaigns: dashboardCounts.campaigns,
    interested: dashboardCounts.interested,
  }

  if (auth.authRequired && auth.status === 'checking') return <main className="auth-loading" role="status">Checking your HireFlow session…</main>
  if (auth.authRequired && auth.status !== 'authenticated') {
    return <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/verify-email" element={<AuthPage mode="verify" />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  }
  const titleMap = {
    '/': [profile.name ? `Welcome, ${profile.name}` : 'Overview', 'Your hiring workspace at a glance.'],
    '/jobs': ['Jobs', 'Manage open roles and keep your hiring moving.'],
    '/candidates': ['Candidate discovery', 'Find promising people using transparent, role-based matching.'],
    '/campaigns': ['Campaigns', 'Prepare and review candidate outreach.'],
    '/interested': ['Interested candidates', 'Follow up with people who have voluntarily raised their hand.'],
    '/follow-ups': ['Follow-ups', 'Keep every conversation moving with a little follow-through.'],
    '/pricing': ['Pricing', 'Choose a plan for your recruitment workload.'],
    '/settings': ['Settings', 'Manage your profile and workspace details.'],
  }
  const [title, subtitle] = titleMap[location.pathname] || titleMap['/']
  const persistenceLabel = !auth.authRequired
    ? 'Browser-only workspace · data saved on this device'
    : dataStatus === 'ready' ? 'Workspace data from server' : dataStatus === 'error' ? 'Server data unavailable' : 'Loading workspace from server'
  const followUpPersistenceLabel = auth.authRequired ? persistenceLabel : 'Session only · candidate-linked reminders are not saved'
  const searchableRoutes = new Set(['/jobs', '/candidates', '/campaigns', '/interested', '/follow-ups'])

  return (
    <AppLayout
      title={title}
      subtitle={subtitle}
      search={search}
      onSearch={setSearch}
      counts={counts}
      profile={profile}
      persistenceLabel={persistenceLabel}
      searchable={searchableRoutes.has(location.pathname)}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen((open) => !open)}
      onCloseSidebar={() => setSidebarOpen(false)}
    >
      {dataError && <div className="workspace-error" role="alert">{dataError}<button type="button" onClick={() => { setDataError(''); setDataStatus('loading'); setLoadRevision((revision) => revision + 1) }}>Retry</button></div>}
      {auth.authRequired && dataStatus === 'loading' && <p className="workspace-loading" role="status">Loading workspace data…</p>}
      <Routes>
        <Route path="/" element={<Dashboard profile={profile} jobs={jobs} followUps={followUps} activity={activity} counts={dashboardCounts} />} />
        <Route path="/jobs" element={<JobsPage jobs={jobs} setJobs={setJobs} createJob={createJob} updateJob={updateJob} updateJobStatus={updateJobStatus} persistenceLabel={persistenceLabel} search={search} />} />
        <Route path="/candidates" element={<CandidatesPage candidates={candidates} setCandidates={setCandidates} createCandidate={createCandidate} persistenceLabel={auth.authRequired ? persistenceLabel : 'In-memory only · cleared when this page reloads'} jobs={jobs} search={search} />} />
        <Route path="/campaigns" element={<CampaignsPage campaigns={campaigns} setCampaigns={setCampaigns} createCampaign={createCampaign} updateCampaign={updateCampaign} persistenceLabel={persistenceLabel} jobs={jobs} search={search} />} />
        <Route path="/interested" element={<InterestedPage candidates={candidates} jobs={jobs} interested={interested} setInterested={setInterested} updateInterestStatus={updateInterestStatus} search={search} />} />
        <Route path="/follow-ups" element={<FollowUpsPage followUps={followUps} setFollowUps={setFollowUps} createFollowUp={createFollowUp} updateFollowUp={updateFollowUp} persistenceLabel={followUpPersistenceLabel} candidates={candidates} search={search} />} />
        <Route path="/pricing" element={<PricingPage initialSelection={auth.authRequired ? planSelection : undefined} onSelectPlan={auth.authRequired ? selectPlan : undefined} />} />
        <Route path="/settings" element={<SettingsPage profile={profile} saveProfile={saveProfile} persistenceMode={auth.authRequired ? 'server' : 'browser'} signOut={auth.authRequired ? auth.signOut : null} />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
        <Route path="/verify-email" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider><RoutedApp /></AuthProvider>
    </BrowserRouter>
  )
}

export default App
