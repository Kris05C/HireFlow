import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { demoCandidates, demoCampaigns, demoFollowUps, demoInterested, demoJobs } from './data/demoData'
import { AppLayout } from './components/Layout'
import { CampaignsPage, CandidatesPage, FollowUpsPage, InterestedPage, JobsPage, SettingsPage } from './pages'
import Dashboard from './pages/Dashboard'
import './App.css'

const readStored = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch (error) {
    console.error(`Could not read ${key} from local storage`, error)
    return fallback
  }
}

function RoutedApp() {
  const location = useLocation()
  const [jobs, setJobs] = useState(() => readStored('hireflow-jobs', demoJobs))
  const [campaigns, setCampaigns] = useState(() => readStored('hireflow-campaigns', demoCampaigns))
  const [followUps, setFollowUps] = useState(() => readStored('hireflow-followups', demoFollowUps))
  const [interested, setInterested] = useState(() => readStored('hireflow-interested', demoInterested))
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('hireflow-jobs', JSON.stringify(jobs))
  }, [jobs])
  useEffect(() => {
    localStorage.setItem('hireflow-campaigns', JSON.stringify(campaigns))
  }, [campaigns])
  useEffect(() => {
    localStorage.setItem('hireflow-followups', JSON.stringify(followUps))
  }, [followUps])
  useEffect(() => {
    localStorage.setItem('hireflow-interested', JSON.stringify(interested))
  }, [interested])
  const titleMap = {
    '/': ['Good morning, Alex', 'Here’s what’s happening with your hiring pipeline today.'],
    '/jobs': ['Jobs', 'Manage open roles and keep your hiring moving.'],
    '/candidates': ['Candidate discovery', 'Find promising people using transparent, role-based matching.'],
    '/campaigns': ['Campaigns', 'Create thoughtful outreach campaigns. Sending is simulated in this demo.'],
    '/interested': ['Interested candidates', 'Follow up with people who have voluntarily raised their hand.'],
    '/follow-ups': ['Follow-ups', 'Keep every conversation moving with a little follow-through.'],
    '/settings': ['Settings', 'Manage your demo workspace and profile preferences.'],
  }
  const [title, subtitle] = titleMap[location.pathname] || titleMap['/']
  const candidateCount = demoCandidates.length
  const counts = useMemo(() => ({
    candidateCount,
    activeJobs: jobs.filter((job) => job.status === 'Active').length,
    campaigns: campaigns.length,
    interested: interested.length,
  }), [jobs, campaigns, interested, candidateCount])

  return (
    <AppLayout
      title={title}
      subtitle={subtitle}
      search={search}
      onSearch={setSearch}
      counts={counts}
      sidebarOpen={sidebarOpen}
      onToggleSidebar={() => setSidebarOpen((open) => !open)}
      onCloseSidebar={() => setSidebarOpen(false)}
    >
      <Routes>
        <Route path="/" element={<Dashboard jobs={jobs} campaigns={campaigns} interested={interested} followUps={followUps} search={search} />} />
        <Route path="/jobs" element={<JobsPage jobs={jobs} setJobs={setJobs} search={search} />} />
        <Route path="/candidates" element={<CandidatesPage candidates={demoCandidates} jobs={jobs} search={search} />} />
        <Route path="/campaigns" element={<CampaignsPage campaigns={campaigns} setCampaigns={setCampaigns} jobs={jobs} search={search} />} />
        <Route path="/interested" element={<InterestedPage candidates={demoCandidates} jobs={jobs} interested={interested} setInterested={setInterested} search={search} />} />
        <Route path="/follow-ups" element={<FollowUpsPage followUps={followUps} setFollowUps={setFollowUps} candidates={demoCandidates} search={search} />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <RoutedApp />
    </BrowserRouter>
  )
}

export default App
