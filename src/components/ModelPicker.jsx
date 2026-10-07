import { useState } from 'react'
import { Field, Alert } from './ui'

/**
 * Pick the model you traded, then tick off its confluences. Creating a model
 * is inline — a name plus the list of things you wait for before entering —
 * because you should never have to leave the entry to add one.
 */
export default function ModelPicker({
  models, modelId, onPickModel, checked, onToggleCheck, createModel,
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [labels, setLabels] = useState(['', '', ''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const model = models.find((m) => m.id === modelId) || null
  const checks = model?.checks || []
  const done = checks.filter((c) => checked.includes(c.id)).length
  const all = checks.length > 0 && done === checks.length

  function setLabel(i, v) {
    setLabels((prev) => {
      const next = [...prev]
      next[i] = v
      // keep one spare blank row so the list grows as you type
      if (i === next.length - 1 && v.trim()) next.push('')
      return next
    })
  }

  async function submitNew() {
    setBusy(true)
    setError('')
    try {
      const created = await createModel(name, labels, note)
      onPickModel(created.id)
      setCreating(false)
      setName(''); setNote(''); setLabels(['', '', ''])
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  if (creating) {
    return (
      <div className="card" style={{ background: 'var(--bg-soft)' }}>
        <div className="card-head">
          <h3>New model</h3>
          <div className="spacer" />
          <button type="button" className="btn-ghost btn-sm" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </div>
        <div className="col" style={{ gap: 12 }}>
          <Alert kind="error">{error}</Alert>
          <Field label="Model name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Opening drive reversal"
              autoFocus
            />
          </Field>
          <Field label="What it is (optional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Fade the first push after the open into the prior day's level"
            />
          </Field>
          <Field label="Confluences — everything you wait for before entering">
            <div className="col" style={{ gap: 7 }}>
              {labels.map((l, i) => (
                <div className="row" key={i} style={{ gap: 8 }}>
                  <span className="rnum">{i + 1}</span>
                  <input
                    value={l}
                    onChange={(e) => setLabel(i, e.target.value)}
                    placeholder={
                      i === 0 ? 'Swept the overnight high'
                      : i === 1 ? 'Displacement on the 1-minute'
                      : i === 2 ? 'Retrace into the fair value gap'
                      : 'Another confluence…'
                    }
                  />
                  {labels.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => setLabels((p) => p.filter((_, x) => x !== i))}
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Field>
          <div className="row">
            <div className="spacer" />
            <button
              type="button"
              className="btn-go"
              onClick={submitNew}
              disabled={busy || !name.trim()}
            >
              {busy ? 'Creating…' : 'Create model'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <Field label="Which model?">
        <div className="row" style={{ gap: 8 }}>
          <select
            value={modelId}
            onChange={(e) => onPickModel(e.target.value)}
            disabled={models.length === 0}
          >
            <option value="">
              {models.length === 0 ? '— no models yet —' : '— no model —'}
            </option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <button type="button" className="btn-sm" onClick={() => setCreating(true)}>
            ＋ New model
          </button>
        </div>
      </Field>

      {model?.note && <div className="tiny faint">{model.note}</div>}

      {model && checks.length === 0 && (
        <div className="tiny faint">
          This model has no confluences listed. Add them in Settings → Models.
        </div>
      )}

      {checks.length > 0 && (
        <div className="confl">
          <div className="row tiny" style={{ marginBottom: 8 }}>
            <span className="faint" style={{ fontWeight: 700, letterSpacing: '0.07em' }}>
              DID YOU WAIT FOR ALL OF THEM?
            </span>
            <div className="spacer" />
            <span className={all ? 'pos' : 'neg'} style={{ fontWeight: 700 }}>
              {done} of {checks.length}
            </span>
          </div>

          <div className="col" style={{ gap: 7 }}>
            {checks.map((c) => {
              const on = checked.includes(c.id)
              return (
                <div
                  key={c.id}
                  className={`checkrow ${on ? 'done' : ''}`}
                  onClick={() => onToggleCheck(c.id)}
                  role="checkbox"
                  aria-checked={on}
                  tabIndex={0}
                  onKeyDown={(e) =>
                    (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), onToggleCheck(c.id))
                  }
                >
                  <span className="box">✓</span>
                  <span className="lbl grow">{c.label}</span>
                </div>
              )
            })}
          </div>

          <div className={`alert ${all ? 'ok' : 'error'}`} style={{ marginTop: 10 }}>
            {all
              ? 'Every confluence confirmed. This was your setup.'
              : `${checks.length - done} confluence${checks.length - done === 1 ? '' : 's'} missing — this was not your model.`}
          </div>
        </div>
      )}
    </div>
  )
}
