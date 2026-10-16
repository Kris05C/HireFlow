import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'

const primaryNav = [
  { to: '/', label: 'Dashboard', icon: 'grid' },
  { to: '/jobs', label: 'Jobs', icon: 'briefcase', countKey: 'activeJobs' },
  { to: '/candidates', label: 'Candidate discovery', icon: 'search' },
  { to: '/campaigns', label: 'Campaigns', icon: 'send', countKey: 'campaigns' },
  { to: '/interested', label: 'Interested candidates', icon: 'heart', countKey: 'interested' },
  { to: '/follow-ups', label: 'Follow-ups', icon: 'clock' },
]

function Sidebar({ counts, open, onClose }) {
  return (
    <>
      {open && <button className="sidebar-backdrop" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Icon name="sparkle" size={21} /></span>
          <span>hireflow<span className="brand-period">.</span></span>
          <button className="sidebar-close" onClick={onClose} aria-label="Close navigation"><Icon name="close" /></button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">S</span>
          <span className="workspace-copy"><strong>Studio North</strong><small>Free workspace</small></span>
          <Icon name="down" size={15} className="workspace-chevron" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {primaryNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={onClose} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.countKey && <span className="nav-count">{counts[item.countKey]}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><Icon name="sparkle" size={16} /></div>
            <strong>Make hiring flow</strong>
            <p>Find your next great hire, all in one place.</p>
            <NavLink to="/settings" className="upgrade-link">Explore your workspace <Icon name="arrowRight" size={14} /></NavLink>
          </div>
          <NavLink to="/settings" onClick={onClose} className={({ isActive }) => `nav-item settings-link ${isActive ? 'active' : ''}`}>
            <Icon name="settings" size={18} /><span>Settings</span>
          </NavLink>
          <div className="profile-row">
            <div className="avatar avatar-indigo">AM</div>
            <div className="profile-copy"><strong>Alex Morgan</strong><small>People & Culture</small></div>
            <Icon name="dots" size={18} className="profile-more" />
          </div>
        </div>
      </aside>
    </>
  )
}

export function AppLayout({ title, subtitle, search, onSearch, counts, sidebarOpen, onToggleSidebar, onCloseSidebar, children }) {
  const searchInput = useRef(null)
  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInput.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  return (
    <div className="app-shell">
      <Sidebar counts={counts} open={sidebarOpen} onClose={onCloseSidebar} />
      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={onToggleSidebar} aria-label="Open navigation"><Icon name="menu" /></button>
          <div className="breadcrumb">Workspace <Icon name="chevron" size={14} /> <span>{title.split(',')[0]}</span></div>
          <div className="topbar-actions">
            <label className="global-search">
              <Icon name="search" size={17} />
              <input ref={searchInput} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search anything..." aria-label="Search current page" />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" size={19} /><span /></button>
            <div className="avatar avatar-indigo top-avatar">AM</div>
          </div>
        </header>
        <main className="page-content">
          <div className="page-heading">
            <div><h1>{title}</h1><p>{subtitle}</p></div>
            {title.startsWith('Good morning') && <div className="today-chip"><Icon name="calendar" size={15} /> Saturday, Oct 17</div>}
          </div>
          {children}
          <footer className="app-footer"><span>HireFlow <span className="footer-dot">·</span> Your hiring, in good flow.</span><span>Demo workspace <span className="demo-dot" /></span></footer>
        </main>
      </div>
    </div>
  )
}
