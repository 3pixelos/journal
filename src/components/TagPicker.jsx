import { useMemo, useState } from 'react'
import { TagChip } from './ui'

const KINDS = [
  { value: 'strategy', label: 'Strategy' },
  { value: 'setup', label: 'Setup' },
  { value: 'mistake', label: 'Mistake' },
  { value: 'other', label: 'Other' },
]

const KIND_COLOR = {
  strategy: '#5b8cff',
  setup: '#3ddc97',
  mistake: '#ff6b6b',
  other: '#ffb454',
}

/**
 * Pick from existing tags or type a new one. `value` is an array of tag ids.
 */
export default function TagPicker({ tags, value, onChange, createTag }) {
  const [text, setText] = useState('')
  const [kind, setKind] = useState('strategy')
  const [busy, setBusy] = useState(false)

  const selected = useMemo(
    () => value.map((id) => tags.find((t) => t.id === id)).filter(Boolean),
    [value, tags]
  )

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase()
    return tags
      .filter((t) => !value.includes(t.id))
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [tags, value, text])

  async function add() {
    const name = text.trim()
    if (!name || busy) return
    setBusy(true)
    try {
      const tag = await createTag(name, kind, KIND_COLOR[kind])
      if (tag && !value.includes(tag.id)) onChange([...value, tag.id])
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="col" style={{ gap: 8 }}>
      {selected.length > 0 && (
        <div className="row-wrap" style={{ gap: 6 }}>
          {selected.map((t) => (
            <TagChip
              key={t.id}
              tag={t}
              onRemove={() => onChange(value.filter((id) => id !== t.id))}
            />
          ))}
        </div>
      )}

      <div className="row" style={{ gap: 6 }}>
        <input
          value={text}
          placeholder="Add a tag…"
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
        <button type="button" className="btn-sm" onClick={add} disabled={!text.trim() || busy}>
          Add
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="row-wrap" style={{ gap: 6 }}>
          {suggestions.map((t) => (
            <TagChip key={t.id} tag={t} onClick={() => onChange([...value, t.id])} />
          ))}
        </div>
      )}
    </div>
  )
}

export { KINDS, KIND_COLOR }
