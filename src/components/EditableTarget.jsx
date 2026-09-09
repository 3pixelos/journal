import { useEffect, useRef, useState } from 'react'
import { money } from '../lib/format'

/**
 * Click-to-edit currency value. Saves on Enter or blur, reverts on Escape —
 * so weekly goals and loss limits can be set from the dashboard itself.
 */
export default function EditableTarget({ value, onSave, label }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? 0))
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)

  useEffect(() => { setDraft(String(value ?? 0)) }, [value])
  useEffect(() => { if (editing) ref.current?.select() }, [editing])

  async function commit() {
    const n = Number(draft)
    setEditing(false)
    if (!Number.isFinite(n) || n === Number(value)) {
      setDraft(String(value ?? 0))
      return
    }
    setSaving(true)
    await onSave(Math.abs(n))
    setSaving(false)
  }

  if (editing) {
    return (
      <input
        ref={ref}
        className="inline-input"
        type="number"
        step="any"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setDraft(String(value ?? 0)); setEditing(false) }
        }}
      />
    )
  }

  return (
    <span
      className="inline-edit"
      onClick={() => setEditing(true)}
      title={`Click to change your ${label}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setEditing(true))}
    >
      {saving ? '…' : money(value)}
      <span className="pencil">✎</span>
    </span>
  )
}
