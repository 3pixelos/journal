import { useMemo, useState } from 'react'
import { TagChip } from './ui'

const KINDS = [
  { value: 'strategy', label: 'Strategy' },
  { value: 'setup', label: 'Setup' },
  { value: 'mistake', label: 'Mistake' },
  { value: 'other', label: 'Other' },
]

const KIND_COLOR = {
  strategy: '#a3a3a3',
  setup: '#22c55e',
  mistake: '#ef4444',
  other: '#737373',
}

/**
 * Every tag you have ever used, as a palette you tap. Selected ones are
 * filled; tapping again removes them. Typing is only for a tag that does
 * not exist yet — the common case is reusing one, so that is the path that
 * takes no keystrokes.
 */
export default function TagPicker({ tags, value, onChange, createTag }) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState('strategy')
  const [busy, setBusy] = useState(false)

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  // Selected first so the current state reads at a glance, then the rest
  // grouped by kind. Typing narrows the palette rather than hiding it.
  const shown = useMemo(() => {
    const q = text.trim().toLowerCase()
    const order = { strategy: 0, setup: 1, mistake: 2, other: 3 }
    return [...tags]
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const sel = Number(value.includes(b.id)) - Number(value.includes(a.id))
        if (sel) return sel
        return (order[a.kind] ?? 9) - (order[b.kind] ?? 9)
          || a.name.localeCompare(b.name)
      })
  }, [tags, value, text])

  const exact = tags.some((t) => t.name.toLowerCase() === text.trim().toLowerCase())
  const canCreate = Boolean(text.trim()) && !exact

  async function add() {
    if (!canCreate || busy) return
    setBusy(true)
    try {
      const tag = await createTag(text.trim(), kind, KIND_COLOR[kind])
      if (tag && !value.includes(tag.id)) onChange([...value, tag.id])
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tagpick">
      {tags.length > 0 ? (
        <>
          <div className="row tiny faint" style={{ marginBottom: 7 }}>
            <span>Tap to add or remove</span>
            <div className="spacer" />
            {value.length > 0 && <span>{value.length} selected</span>}
          </div>
          <div className="row-wrap tagpick-palette">
            {shown.map((t) => (
              <TagChip
                key={t.id}
                tag={t}
                active={value.includes(t.id)}
                onClick={() => toggle(t.id)}
              />
            ))}
            {shown.length === 0 && (
              <span className="tiny faint">No tag matches “{text.trim()}” — add it below.</span>
            )}
          </div>
        </>
      ) : (
        <div className="tiny faint" style={{ marginBottom: 7 }}>
          No tags yet. Create one and it stays here to reuse.
        </div>
      )}

      <div className="row tagpick-new" style={{ gap: 6 }}>
        <input
          value={text}
          placeholder={tags.length ? 'Search, or type a new tag…' : 'Your first tag…'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ width: 118 }}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>{k.label}</option>
          ))}
        </select>
        <button type="button" className="btn-sm" onClick={add} disabled={!canCreate || busy}>
          {busy ? '…' : 'Create'}
        </button>
      </div>
    </div>
  )
}

export { KINDS, KIND_COLOR }
