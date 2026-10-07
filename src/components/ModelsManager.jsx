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

  async function addCheck(model) {
    const label = (drafts[model.id] || '').trim()
    if (!label) return
    const sort = Math.max(0, ...model.checks.map((c) => c.sort_order)) + 1
    await supabase.from('model_checks')
      .insert({ model_id: model.id, user_id: user.id, label, sort_order: sort })
    setDrafts((d) => ({ ...d, [model.id]: '' }))
    reload()
  }

  async function removeCheck(id) {
    await supabase.from('model_checks').delete().eq('id', id)
    reload()
  }

  async function rename(model, name) {
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
          {models.map((m) => (
            <div className="card" key={m.id} style={{ background: 'var(--bg-soft)' }}>
              <div className="row mb" style={{ gap: 8 }}>
                <input
                  defaultValue={m.name}
                  onBlur={(e) => rename(m, e.target.value)}
                  style={{ fontWeight: 700 }}
                />
                <DeleteButton onDelete={() => deleteModel(m.id)} label="Delete model" />
              </div>
              {m.note && <div className="tiny faint mb">{m.note}</div>}

              <div className="col" style={{ gap: 6 }}>
                {m.checks.map((c, i) => (
                  <div className="row" key={c.id} style={{ gap: 8 }}>
                    <span className="rnum">{i + 1}</span>
                    <span className="grow small">{c.label}</span>
                    <button className="btn-ghost btn-sm" onClick={() => removeCheck(c.id)}>✕</button>
                  </div>
                ))}
                {m.checks.length === 0 && (
                  <div className="tiny faint">No steps yet.</div>
                )}
              </div>

              <div className="row mt" style={{ gap: 8 }}>
                <input
                  value={drafts[m.id] || ''}
                  placeholder="Add a step…"
                  onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCheck(m) } }}
                />
                <button className="btn-sm" onClick={() => addCheck(m)}
                        disabled={!(drafts[m.id] || '').trim()}>
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="small faint mt">
        Deleting a model leaves past entries intact — they just stop showing which model was used.
      </div>
    </Card>
  )
}
