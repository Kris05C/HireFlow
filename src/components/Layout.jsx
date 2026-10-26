import { useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { companyConfig } from '../config'
import { Icon } from './Icon'

const primaryNav = [
  { to: '/', label: 'Dashboard', icon: 'grid' },
  { to: '/jobs', label: 'Jobs', icon: 'briefcase', countKey: 'activeJobs' },
  { to: '/candidates', label: 'Candidate discovery', icon: 'search' },
  { to: '/campaigns', label: 'Campaigns', icon: 'send', countKey: 'campaigns' },
  { to: '/interested', label: 'Interested candidates', icon: 'heart', countKey: 'interested' },
  { to: '/follow-ups', label: 'Follow-ups', icon: 'clock' },
  { to: '/pricing', label: 'Pricing', icon: 'grid' },
]

function getInitials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'AC'
}

function Sidebar({ counts, profile, open, onClose }) {
  return (
    <>
      {open && <button className="sidebar-backdrop" onClick={onClose} aria-label="Close navigation" />}
      <aside id="app-sidebar" className={`sidebar ${open ? 'sidebar-open' : ''}`} aria-label="Workspace navigation">
        <div className="brand-row">
          <Link to="/" onClick={onClose} className="brand" aria-label="HireFlow dashboard">
            <span className="brand-mark"><Icon name="sparkle" size={21} /></span>
            <span>HireFlow</span>
          </Link>
          <button className="sidebar-close" onClick={onClose} aria-label="Close navigation"><Icon name="close" /></button>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">{getInitials(profile.company || companyConfig.workspaceFallback)}</span>
          <span className="workspace-copy"><strong>{profile.company || companyConfig.workspaceFallback}</strong><small>Workspace</small></span>
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
            <strong>Plans for every team</strong>
            <p>Recruitment plans from ₹1,499 per month.</p>
            <NavLink to="/pricing" className="upgrade-link">Compare plans <Icon name="arrowRight" size={14} /></NavLink>
          </div>
          <NavLink to="/settings" onClick={onClose} className={({ isActive }) => `nav-item settings-link ${isActive ? 'active' : ''}`}>
            <Icon name="settings" size={18} /><span>Settings</span>
          </NavLink>
          <div className="profile-row">
            <div className="avatar avatar-indigo">{getInitials(profile.name || companyConfig.accountFallback)}</div>
            <div className="profile-copy"><strong>{profile.name || companyConfig.accountFallback}</strong><small>{profile.role || companyConfig.roleFallback}</small></div>
          </div>
        </div>
      </aside>
    </>
  )
}

export function AppLayout({ title, subtitle, search, onSearch, counts, profile, persistenceLabel, searchable, sidebarOpen, onToggleSidebar, onCloseSidebar, children }) {
  const searchInput = useRef(null)
  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInput.current?.focus()
      }
    }
    const closeSidebar = (event) => {
      if (event.key === 'Escape') onCloseSidebar()
    }
    window.addEventListener('keydown', focusSearch)
    window.addEventListener('keydown', closeSidebar)
    return () => {
      window.removeEventListener('keydown', focusSearch)
      window.removeEventListener('keydown', closeSidebar)
    }
  }, [onCloseSidebar])

  return (
    <div className="app-shell">
      <Sidebar counts={counts} profile={profile} open={sidebarOpen} onClose={onCloseSidebar} />
      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={onToggleSidebar} aria-expanded={sidebarOpen} aria-controls="app-sidebar" aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}><Icon name="menu" /></button>
          <div className="breadcrumb">Workspace <Icon name="chevron" size={14} /> <span>{title.split(',')[0]}</span></div>
          <div className="topbar-actions">
            {searchable && <label className="global-search">
              <Icon name="search" size={17} />
              <input ref={searchInput} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search anything..." aria-label="Search current page" />
              <kbd>⌘ K</kbd>
            </label>}
            <div className="avatar avatar-indigo top-avatar">{getInitials(profile.name || companyConfig.accountFallback)}</div>
          </div>
        </header>
        <main className="page-content">
          <div className="page-heading">
            <div><h1>{title}</h1><p>{subtitle}</p></div>
          </div>
          {children}
          <footer className="app-footer"><span>{companyConfig.name} <span className="footer-dot">·</span> {persistenceLabel}</span><span className="footer-contact"><a href={`mailto:${companyConfig.businessEmail}`}>{companyConfig.businessEmail}</a><a href={`tel:${companyConfig.phoneLink}`}>{companyConfig.phone}</a></span></footer>
        </main>
      </div>
    </div>
  )
}
