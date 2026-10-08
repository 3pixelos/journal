import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useModels } from '../lib/hooks'
import { Card, Empty, Loading, DeleteButton } from './ui'

/** Edit the models and their step lists created while journalling. */
export default function ModelsManager() {
  const { user } = useAuth()
  const { models, loading, reload, deleteModel } = useModels()
  const [drafts, setDrafts] = useState({})
  const [busy, setBusy] = useState(false)

  async function addStep(model) {
    const label = (drafts[model.id] || '').trim()
    if (!label) return
    const sort = Math.max(0, ...model.checks.map((c) => c.sort_order)) + 1
    await supabase.from('model_checks')
      .insert({ model_id: model.id, user_id: user.id, label, sort_order: sort })
    setDrafts((d) => ({ ...d, [model.id]: '' }))
    reload()
  }

  async function renameStep(check, label) {
    const clean = label.trim()
    if (!clean || clean === check.label) return
    await supabase.from('model_checks').update({ label: clean }).eq('id', check.id)
    reload()
  }

  async function removeStep(id) {
    await supabase.from('model_checks').delete().eq('id', id)
    reload()
  }

  /**
   * Swap a step with its neighbour. Swapping sort_order rather than
   * rewriting the list keeps every step's id — and so every tick already
   * recorded against it on past entries.
   */
  async function moveStep(model, check, dir) {
    if (busy) return
    const ordered = [...model.checks].sort((a, b) => a.sort_order - b.sort_order)
    const i = ordered.findIndex((c) => c.id === check.id)
    const swap = ordered[i + dir]
    if (!swap) return
    setBusy(true)
    await Promise.all([
      supabase.from('model_checks').update({ sort_order: swap.sort_order }).eq('id', check.id),
      supabase.from('model_checks').update({ sort_order: check.sort_order }).eq('id', swap.id),
    ])
    setBusy(false)
    reload()
  }

  async function renameModel(model, name) {
    const clean = name.trim()
    if (!clean || clean === model.name) return
    await supabase.from('models').update({ name: clean }).eq('id', model.id)
    reload()
  }

  return (
    <Card title="Models">
      {loading ? (
        <Loading rows={3} />
      ) : models.length === 0 ? (
        <Empty
          icon="◈"
          title="No models yet"
          hint="Create one while writing a journal entry — name it and list the steps you follow."
        />
      ) : (
        <div className="col" style={{ gap: 14 }}>
          {models.map((m) => {
            const ordered = [...m.checks].sort((a, b) => a.sort_order - b.sort_order)
            return (
              <div className="card" key={m.id} style={{ background: 'var(--bg-soft)' }}>
                <div className="row mb" style={{ gap: 8 }}>
                  <input
                    defaultValue={m.name}
                    onBlur={(e) => renameModel(m, e.target.value)}
                    style={{ fontWeight: 700 }}
                  />
                  <DeleteButton onDelete={() => deleteModel(m.id)} label="Delete model" />
                </div>
                {m.note && <div className="tiny faint mb">{m.note}</div>}

                <div className="col" style={{ gap: 6 }}>
                  {ordered.map((c, i) => (
                    <div className="row step-edit" key={c.id} style={{ gap: 7 }}>
                      <span className="step-n">{i + 1}</span>
                      <input
                        defaultValue={c.label}
                        key={`${c.id}-${c.label}`}
                        onBlur={(e) => renameStep(c, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                      />
                      <button className="btn-ghost btn-sm" title="Move up" disabled={i === 0}
                              onClick={() => moveStep(m, c, -1)}>↑</button>
                      <button className="btn-ghost btn-sm" title="Move down"
                              disabled={i === ordered.length - 1}
                              onClick={() => moveStep(m, c, 1)}>↓</button>
                      <DeleteButton onDelete={() => removeStep(c.id)} label="✕" />
                    </div>
                  ))}
                  {ordered.length === 0 && <div className="tiny faint">No steps yet.</div>}
                </div>

                <div className="row mt" style={{ gap: 8 }}>
                  <input
                    value={drafts[m.id] || ''}
                    placeholder="Add a step…"
                    onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStep(m) } }}
                  />
                  <button className="btn-sm" onClick={() => addStep(m)}
                          disabled={!(drafts[m.id] || '').trim()}>
                    Add
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div className="small faint mt">
        Edit a step's wording in place, reorder with the arrows, or remove it. Reordering
        keeps every tick already recorded on past entries; deleting a step drops its ticks
        with it.
      </div>
    </Card>
  )
}
