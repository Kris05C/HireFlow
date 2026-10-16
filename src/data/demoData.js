export const demoJobs = [
  { id: 'job-1', title: 'Senior Product Designer', department: 'Design', location: 'New York, NY', type: 'Full-time', status: 'Active', applicants: 48, posted: 'Oct 12, 2026', skills: ['Figma', 'Product design', 'Prototyping'] },
  { id: 'job-2', title: 'Frontend Engineer', department: 'Engineering', location: 'Remote · US', type: 'Full-time', status: 'Active', applicants: 36, posted: 'Oct 10, 2026', skills: ['React', 'TypeScript', 'CSS'] },
  { id: 'job-3', title: 'People Operations Lead', department: 'People', location: 'Austin, TX', type: 'Full-time', status: 'Active', applicants: 24, posted: 'Oct 08, 2026', skills: ['People ops', 'HR systems', 'Culture'] },
  { id: 'job-4', title: 'Growth Marketing Manager', department: 'Marketing', location: 'Remote · US', type: 'Full-time', status: 'Active', applicants: 31, posted: 'Oct 05, 2026', skills: ['Growth', 'SEO', 'Analytics'] },
  { id: 'job-5', title: 'Customer Success Associate', department: 'Customer success', location: 'Chicago, IL', type: 'Full-time', status: 'Active', applicants: 19, posted: 'Oct 02, 2026', skills: ['Customer success', 'Communication', 'SaaS'] },
  { id: 'job-6', title: 'Data Analyst', department: 'Engineering', location: 'New York, NY', type: 'Contract', status: 'Paused', applicants: 27, posted: 'Sep 26, 2026', skills: ['SQL', 'Python', 'Analytics'] },
  { id: 'job-7', title: 'Brand Designer', department: 'Design', location: 'Remote · US', type: 'Contract', status: 'Closed', applicants: 42, posted: 'Sep 18, 2026', skills: ['Brand', 'Illustration', 'Figma'] },
]

export const demoCandidates = [
  { id: 'candidate-1', name: 'Olivia Rhye', initials: 'OR', role: 'Senior Product Designer', location: 'New York, NY', experience: '8 years', skills: ['Figma', 'Product design', 'Prototyping', 'Design systems'], color: 'lavender' },
  { id: 'candidate-2', name: 'Phoenix Baker', initials: 'PB', role: 'Frontend Engineer', location: 'Remote · US', experience: '6 years', skills: ['React', 'TypeScript', 'CSS', 'Accessibility'], color: 'peach' },
  { id: 'candidate-3', name: 'Lana Steiner', initials: 'LS', role: 'People Operations Lead', location: 'Austin, TX', experience: '9 years', skills: ['People ops', 'HR systems', 'Culture', 'Recruiting'], color: 'mint' },
  { id: 'candidate-4', name: 'Demi Wilkinson', initials: 'DW', role: 'Growth Marketing Manager', location: 'Remote · US', experience: '7 years', skills: ['Growth', 'SEO', 'Analytics', 'Content'], color: 'blue' },
  { id: 'candidate-5', name: 'Candice Wu', initials: 'CW', role: 'Product Designer', location: 'Brooklyn, NY', experience: '5 years', skills: ['Figma', 'Product design', 'Prototyping'], color: 'rose' },
  { id: 'candidate-6', name: 'Natali Craig', initials: 'NC', role: 'Data Analyst', location: 'New York, NY', experience: '4 years', skills: ['SQL', 'Python', 'Analytics', 'Dashboards'], color: 'gold' },
  { id: 'candidate-7', name: 'Drew Cano', initials: 'DC', role: 'Customer Success Associate', location: 'Chicago, IL', experience: '3 years', skills: ['Customer success', 'Communication', 'SaaS'], color: 'mint' },
  { id: 'candidate-8', name: 'Orlando Diggs', initials: 'OD', role: 'Frontend Engineer', location: 'Seattle, WA', experience: '7 years', skills: ['React', 'TypeScript', 'CSS', 'Testing'], color: 'peach' },
]

export const demoInterested = [
  { candidateId: 'candidate-1', jobId: 'job-1', status: 'New', date: 'Oct 16, 2026' },
  { candidateId: 'candidate-2', jobId: 'job-2', status: 'Contacted', date: 'Oct 15, 2026' },
  { candidateId: 'candidate-5', jobId: 'job-1', status: 'In review', date: 'Oct 14, 2026' },
  { candidateId: 'candidate-7', jobId: 'job-5', status: 'New', date: 'Oct 13, 2026' },
  { candidateId: 'candidate-3', jobId: 'job-3', status: 'Contacted', date: 'Oct 11, 2026' },
]

export const demoCampaigns = [
  { id: 'campaign-1', name: 'Product designers — October', jobId: 'job-1', audience: 18, status: 'Sent', date: 'Oct 14, 2026', subject: 'A design role you might love' },
  { id: 'campaign-2', name: 'Frontend talent — Q4', jobId: 'job-2', audience: 24, status: 'Draft', date: 'Oct 12, 2026', subject: 'Build something thoughtful with us' },
]

export const demoFollowUps = [
  { id: 'followup-1', candidateId: 'candidate-2', title: 'Share engineering take-home details', dueDate: '2026-10-17', completed: false },
  { id: 'followup-2', candidateId: 'candidate-1', title: 'Schedule portfolio conversation', dueDate: '2026-10-17', completed: false },
  { id: 'followup-3', candidateId: 'candidate-5', title: 'Send a friendly check-in', dueDate: '2026-10-19', completed: false },
  { id: 'followup-4', candidateId: 'candidate-3', title: 'Review people ops interview notes', dueDate: '2026-10-15', completed: true },
]
