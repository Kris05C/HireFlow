import { Link } from 'react-router-dom'
import { demoCandidates } from '../data/demoData'
import { Avatar, EmptyState, SectionHeading, StatusBadge } from '../components/UI'
import { Icon } from '../components/Icon'

const activity = [
  { id: 1, type: 'interested', name: 'Olivia Rhye', detail: 'expressed interest in Senior Product Designer', time: '12 min ago', candidateId: 'candidate-1' },
  { id: 2, type: 'application', name: 'Phoenix Baker', detail: 'applied for Frontend Engineer', time: '48 min ago', candidateId: 'candidate-2' },
  { id: 3, type: 'campaign', name: 'Product designers — October', detail: 'campaign moved to sent', time: '2 hours ago' },
  { id: 4, type: 'interested', name: 'Lana Steiner', detail: 'expressed interest in People Operations Lead', time: 'Yesterday', candidateId: 'candidate-3' },
]

function MetricCard({ icon, label, value, change, tint, href }) {
  return <Link to={href} className="metric-card"><div className={`metric-icon ${tint}`}><Icon name={icon} size={19} /></div><span className="metric-label">{label}</span><div className="metric-value-row"><strong>{value}</strong><span className="metric-change"><Icon name="trend" size={13} />{change}</span></div><span className="metric-footnote">vs. last month <Icon name="arrow" size={13} /></span></Link>
}

function Dashboard({ jobs, campaigns, interested, followUps, search }) {
  const metrics = [
    { icon: 'users', label: 'Demo candidates', value: demoCandidates.length, change: '+12.5%', tint: 'metric-lilac', href: '/candidates' },
    { icon: 'briefcase', label: 'Active jobs', value: jobs.filter((job) => job.status === 'Active').length, change: '+2 this month', tint: 'metric-blue', href: '/jobs' },
    { icon: 'send', label: 'Campaigns', value: campaigns.length, change: '2 drafts', tint: 'metric-peach', href: '/campaigns' },
    { icon: 'heart', label: 'Interested', value: interested.length, change: '+3 this week', tint: 'metric-mint', href: '/interested' },
  ]
  const visibleActivity = activity.filter((item) => !search || `${item.name} ${item.detail}`.toLowerCase().includes(search.toLowerCase()))
  const upcoming = followUps.filter((item) => !item.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3)
  const bars = [31, 46, 40, 61, 51, 76, 58, 83, 67, 91, 74, 100]
  return (
    <>
      <section className="welcome-banner">
        <div className="welcome-copy"><span className="welcome-overline"><span className="welcome-dot" /> YOUR HIRING OVERVIEW</span><h2>Great teams start with<br /><em>great conversations.</em></h2><p>You’re building something good. Here’s the latest from your team.</p><Link className="welcome-cta" to="/candidates">Discover candidates <Icon name="arrowRight" size={16} /></Link></div>
        <div className="welcome-art" aria-hidden="true"><div className="welcome-orbit orbit-outer" /><div className="welcome-orbit orbit-inner" /><div className="welcome-core"><Icon name="sparkle" size={31} /></div><span className="floating-note note-a"><span className="mini-avatar mini-lilac">OR</span> Olivia is interested <span className="note-check"><Icon name="check" size={12} /></span></span><span className="floating-note note-b"><Icon name="trend" size={16} /> A great week ahead</span><span className="floating-dot dot-a" /><span className="floating-dot dot-b" /></div>
        <span className="welcome-scribble" aria-hidden="true">✳</span>
      </section>
      <div className="metrics-grid">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>
      <div className="dashboard-columns">
        <section className="panel overview-panel"><SectionHeading title="Hiring overview" detail="A look at your candidate pipeline." action={<button className="period-select">Last 12 months <Icon name="down" size={14} /></button>} />
          <div className="chart-summary"><div><strong>248</strong><span>Total candidates</span></div><div className="chart-change"><Icon name="trend" size={14} /> 18.2% <span>vs last year</span></div></div>
          <div className="bar-chart" role="img" aria-label="Candidate pipeline grew steadily over the last twelve months"><div className="chart-y-labels"><span>100</span><span>75</span><span>50</span><span>25</span><span>0</span></div><div className="chart-content"><div className="chart-grid-lines"><i /><i /><i /><i /><i /></div><div className="bars">{bars.map((height, index) => <div className="bar-column" key={index}><div className={`chart-bar ${index === 11 ? 'chart-bar-current' : ''}`} style={{ height: `${height}%` }} /><span>{['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'][index]}</span></div>)}</div></div></div>
          <div className="chart-legend"><span><i /> Candidates added</span><span className="chart-period-note">Illustrative demo data</span></div>
        </section>
        <section className="panel activity-panel"><SectionHeading title="Recent activity" detail="Little things moving hiring forward." />
          <div className="activity-list">{visibleActivity.length ? visibleActivity.map((item) => {
            const candidate = demoCandidates.find((person) => person.id === item.candidateId)
            return <div className="activity-item" key={item.id}><div className="activity-avatar">{candidate ? <Avatar candidate={candidate} size="small" /> : <span className={`activity-icon activity-${item.type}`}><Icon name={item.type === 'campaign' ? 'send' : 'briefcase'} size={15} /></span>}</div><div className="activity-copy"><p><strong>{item.name}</strong> {item.detail}</p><span>{item.time}</span></div></div>
          }) : <EmptyState icon="search" title="Nothing matches" detail="Try searching for a different activity." />}</div>
          <Link to="/interested" className="activity-footer-link">View interested candidates <Icon name="arrowRight" size={15} /></Link>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel open-roles-panel"><SectionHeading title="Open roles" detail="Your team is growing in all the right ways." action={<Link to="/jobs" className="text-link">View all <Icon name="arrowRight" size={14} /></Link>} />
          <div className="open-roles-list">{jobs.filter((job) => job.status === 'Active').slice(0, 4).map((job, index) => <Link to="/jobs" className="open-role-row" key={job.id}><span className={`job-symbol job-symbol-${index % 4}`}><Icon name="briefcase" size={16} /></span><div className="open-role-copy"><strong>{job.title}</strong><span>{job.department} <i>·</i> {job.location}</span></div><span className="role-applicants">{job.applicants}<small> applicants</small></span><StatusBadge status={job.status} /></Link>)}</div>
        </section>
        <section className="panel quick-actions-panel"><SectionHeading title="Quick actions" detail="One good next step." />
          <div className="quick-actions"><Link to="/jobs" className="quick-action"><span className="quick-icon quick-blue"><Icon name="plus" size={17} /></span><span><strong>Add a job</strong><small>Grow your team</small></span><Icon name="chevron" size={16} /></Link><Link to="/campaigns" className="quick-action"><span className="quick-icon quick-lilac"><Icon name="send" size={16} /></span><span><strong>New campaign</strong><small>Start a conversation</small></span><Icon name="chevron" size={16} /></Link><Link to="/follow-ups" className="quick-action"><span className="quick-icon quick-peach"><Icon name="clock" size={16} /></span><span><strong>Follow up</strong><small>{upcoming.length} reminders to keep close</small></span><Icon name="chevron" size={16} /></Link></div>
          <div className="quick-note"><Icon name="sparkle" size={14} /> Great work takes good people.</div>
        </section>
      </div>
    </>
  )
}

export default Dashboard
