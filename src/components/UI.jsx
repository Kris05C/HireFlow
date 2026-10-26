import { useEffect, useRef } from 'react'
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
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const dialog = dialogRef.current
    const focusableSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    const focusInitial = () => {
      const autofocus = dialog?.querySelector('[autofocus]')
      const firstFocusable = dialog?.querySelector(focusableSelector)
      ;(autofocus || firstFocusable)?.focus()
    }
    const frame = requestAnimationFrame(focusInitial)
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll(focusableSelector)]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className={`hf-modal ${wide ? 'hf-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}>
        <div className="modal-heading"><div><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div>
        {children}
      </section>
    </div>
  )
}
