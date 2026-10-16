import { Icon } from './Icon'

export function Button({ children, variant = 'primary', icon, onClick, type = 'button', className = '', disabled = false }) {
  return (
    <button type={type} className={`hf-button hf-button-${variant} ${className}`} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={16} />}{children}
    </button>
  )
}

export function SectionHeading({ title, detail, action }) {
  return <div className="section-heading"><div><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>
}

export function StatusBadge({ status }) {
  const className = status.toLowerCase().replaceAll(' ', '-')
  return <span className={`status-badge status-${className}`}><span className="status-dot" />{status}</span>
}

export function Avatar({ candidate, size }) {
  return <span className={`avatar avatar-${candidate.color} ${size === 'small' ? 'avatar-small' : ''}`}>{candidate.initials}</span>
}

export function EmptyState({ icon = 'search', title, detail }) {
  return <div className="empty-state"><span><Icon name={icon} size={22} /></span><strong>{title}</strong><p>{detail}</p></div>
}

export function SearchFilter({ value, onChange, placeholder = 'Search...' }) {
  return <label className="table-search"><Icon name="search" size={16} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

export function FormField({ label, children, hint }) {
  return <label className="form-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className={`hf-modal ${wide ? 'hf-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div>
        {children}
      </section>
    </div>
  )
}
