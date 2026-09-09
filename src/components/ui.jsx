import { useEffect, useState } from 'react'
import { money, pnlClass } from '../lib/format'

export function Card({ title, action, children, className = '', ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {(title || action) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          <div className="spacer" />
          {action}
        </div>
      )}
      {children}
    </div>
  )
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className={`value mono ${tone || ''}`}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

export function MoneyStat({ label, amount, sub }) {
  return (
    <Stat
      label={label}
      value={money(amount, { sign: true })}
      tone={pnlClass(amount)}
      sub={sub}
    />
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <div className="spacer" />
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Empty({ icon = '○', title, hint, action }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      {hint && <div className="small" style={{ marginTop: 4 }}>{hint}</div>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  )
}

export function Loading({ rows = 3 }) {
  return (
    <div className="col" style={{ gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  )
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null
  return <div className={`alert ${kind}`}>{children}</div>
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Lightbox({ src, onClose }) {
  if (!src) return null
  return (
    <div className="lightbox" onClick={onClose}>
      <img src={src} alt="Chart screenshot" />
    </div>
  )
}

export function TagChip({ tag, onRemove, onClick, active }) {
  return (
    <span
      className={`chip ${active ? 'on' : ''} ${onClick ? 'chip-btn' : ''}`}
      onClick={onClick}
      title={tag.kind}
    >
      <i className="tag-dot" style={{ background: tag.color || 'var(--accent)' }} />
      {tag.name}
      {onRemove && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(tag) }}>✕</button>
      )}
    </span>
  )
}

/** Confirm-once destructive button. */
export function DeleteButton({ onDelete, label = 'Delete', className = 'btn-danger btn-sm' }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      type="button"
      className={className}
      onClick={() => (armed ? onDelete() : setArmed(true))}
    >
      {armed ? 'Sure?' : label}
    </button>
  )
}
