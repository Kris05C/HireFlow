import { Link } from 'react-router-dom'
import { EmptyState, SectionHeading, StatusBadge } from '../components/UI'
import { Icon } from '../components/Icon'

function MetricCard({ icon, label, value, tint, href }) {
  return <Link to={href} className="metric-card"><div className={`metric-icon ${tint}`}><Icon name={icon} size={19} /></div><span className="metric-label">{label}</span><div className="metric-value-row"><strong>{value}</strong></div><span className="metric-footnote">Current workspace total</span></Link>
}

function Dashboard({ profile, jobs, followUps, activity, counts }) {
  const metrics = [
    { icon: 'users', label: 'Candidate profiles', value: counts.candidates, tint: 'metric-lilac', href: '/candidates' },
    { icon: 'briefcase', label: 'Active jobs', value: counts.activeJobs, tint: 'metric-blue', href: '/jobs' },
    { icon: 'send', label: 'Campaigns', value: counts.campaigns, tint: 'metric-peach', href: '/campaigns' },
    { icon: 'heart', label: 'Interested candidates', value: counts.interested, tint: 'metric-mint', href: '/interested' },
  ]
  const upcoming = followUps.filter((item) => !item.completed).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3)
  return (
    <>
      <section className="welcome-banner">
        <div className="welcome-copy"><span className="welcome-overline"><span className="welcome-dot" /> {profile.company || 'WORKSPACE'}</span><h2>Find talent.<br /><em>Connect smarter.</em></h2><p>Your recruitment workspace, ready for your first role.</p><Link className="welcome-cta" to="/jobs?new=1">Create a job <Icon name="arrowRight" size={16} /></Link></div>
        <div className="welcome-art" aria-hidden="true"><div className="welcome-orbit orbit-outer" /><div className="welcome-orbit orbit-inner" /><div className="welcome-core"><Icon name="sparkle" size={31} /></div></div>
      </section>
      <div className="metrics-grid">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>
      <div className="dashboard-columns">
        <section className="panel overview-panel"><SectionHeading title="Hiring overview" detail="Your current recruitment pipeline." />
          <div className="pipeline-summary"><div><strong>{counts.jobs}</strong><span>Roles created</span></div><div><strong>{counts.candidates}</strong><span>Candidate profiles</span></div><div><strong>{counts.interested}</strong><span>Expressions of interest</span></div></div>
          {!counts.jobs && <EmptyState icon="briefcase" title="Your workspace is ready" detail="Create your first job to start organizing recruitment." />}
        </section>
        <section className="panel activity-panel"><SectionHeading title="Recent activity" detail="Recorded changes in this workspace." />
          <div className="activity-list">{activity.length ? activity.slice(0, 6).map((item) => <div className="activity-item" key={item.id}><span className={`activity-icon activity-${item.entity_type || 'workspace'}`}><Icon name={item.entity_type === 'campaign' ? 'send' : item.entity_type === 'follow_up' ? 'clock' : 'briefcase'} size={15} /></span><div className="activity-copy"><p>{item.summary}</p><span>{new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div></div>) : <EmptyState icon="clock" title="No activity yet" detail="Recorded job, campaign, and follow-up changes will appear here." />}</div>
          <Link to="/interested" className="activity-footer-link">View interested candidates <Icon name="arrowRight" size={15} /></Link>
        </section>
      </div>
      <section className="panel outreach-health-panel">
        <SectionHeading title="Outreach health" detail="Live recipient states from your workspace." action={<Link to="/campaigns" className="text-link">Review campaigns <Icon name="arrowRight" size={14} /></Link>} />
        <div className="outreach-health-grid">
          <div><span className="health-label">Queued</span><strong>{counts.outreach?.queued || 0}</strong><small>Waiting for delivery</small></div>
          <div><span className="health-label">Sending</span><strong>{counts.outreach?.sending || 0}</strong><small>Claimed by worker</small></div>
          <div><span className="health-label">Delivered</span><strong>{counts.outreach?.sent || 0}</strong><small>Provider delivery states</small></div>
          <div><span className="health-label">Suppressed</span><strong>{counts.outreach?.unsubscribed || 0}</strong><small>Unsubscribe protection</small></div>
        </div>
        {!counts.outreach?.queued && !counts.outreach?.sending && !counts.outreach?.sent && !counts.outreach?.unsubscribed && <EmptyState icon="send" title="No outreach activity yet" detail="Queueing remains explicit and no email is sent from this dashboard." />}
      </section>
      <div className="dashboard-bottom">
        <section className="panel open-roles-panel"><SectionHeading title="Open roles" detail="Your team is growing in all the right ways." action={<Link to="/jobs" className="text-link">View all <Icon name="arrowRight" size={14} /></Link>} />
          <div className="open-roles-list">{jobs.filter((job) => job.status === 'Active').slice(0, 4).map((job, index) => <Link to="/jobs" className="open-role-row" key={job.id}><span className={`job-symbol job-symbol-${index % 4}`}><Icon name="briefcase" size={16} /></span><div className="open-role-copy"><strong>{job.title}</strong><span>{job.department} <i>·</i> {job.location}</span></div><span className="role-applicants">{job.applicants}<small> applicants</small></span><StatusBadge status={job.status} /></Link>)}</div>
          {!jobs.some((job) => job.status === 'Active') && <EmptyState icon="briefcase" title="No active roles yet" detail="Create or activate a job to see it here." />}
        </section>
        <section className="panel quick-actions-panel"><SectionHeading title="Quick actions" detail="One good next step." />
          <div className="quick-actions"><Link to="/jobs?new=1" className="quick-action"><span className="quick-icon quick-blue"><Icon name="plus" size={17} /></span><span><strong>Add a job</strong><small>Grow your team</small></span><Icon name="chevron" size={16} /></Link><Link to="/campaigns?new=1" className="quick-action"><span className="quick-icon quick-lilac"><Icon name="send" size={16} /></span><span><strong>New campaign</strong><small>Start a conversation</small></span><Icon name="chevron" size={16} /></Link><Link to="/follow-ups" className="quick-action"><span className="quick-icon quick-peach"><Icon name="clock" size={16} /></span><span><strong>Follow up</strong><small>{upcoming.length} reminders to keep close</small></span><Icon name="chevron" size={16} /></Link></div>
          <div className="quick-note"><Icon name="sparkle" size={14} /> Built for thoughtful recruitment.</div>
        </section>
      </div>
    </>
  )
}

export default Dashboard
