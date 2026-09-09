import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useAccounts, useTags, useTitle } from '../lib/hooks'
import { money } from '../lib/format'
import { Card, Field, Alert, DeleteButton, TagChip, Empty } from '../components/ui'
import { KINDS } from '../components/TagPicker'

export default function Settings() {
  useTitle('Settings')
  const { user, profile, settings, setProfile, setSettings, signOut } = useAuth()
  const { accounts, reload: reloadAccounts } = useAccounts()
  const { tags, deleteTag, reload: reloadTags } = useTags()

  const [name, setName] = useState('')
  const [goals, setGoals] = useState({ weekly_goal: '', weekly_max_loss: '', daily_max_loss: '' })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const [newAccount, setNewAccount] = useState({ name: '', broker: '', starting_balance: '' })
  const [pw, setPw] = useState({ next: '', confirm: '' })

  useEffect(() => { setName(profile?.display_name || '') }, [profile])
  useEffect(() => {
    if (!settings) return
    setGoals({
      weekly_goal: settings.weekly_goal ?? '',
      weekly_max_loss: settings.weekly_max_loss ?? '',
      daily_max_loss: settings.daily_max_loss ?? '',
    })
  }, [settings])

  function flash(m) {
    setMsg(m)
    setErr('')
    setTimeout(() => setMsg(''), 2500)
  }

  async function saveProfile(e) {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim() || 'Trader' })
      .eq('id', user.id)
      .select()
      .single()
    setBusy(false)
    if (error) {
      // display names double as login identifiers, so they must be unique
      return setErr(
        error.code === '23505'
          ? 'That display name is already taken — pick another.'
          : error.message
      )
    }
    setProfile(data)
    flash('Profile saved.')
  }

  async function saveGoals(e) {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase
      .from('settings')
      .update({
        weekly_goal: Number(goals.weekly_goal) || 0,
        weekly_max_loss: Number(goals.weekly_max_loss) || 0,
        daily_max_loss: Number(goals.daily_max_loss) || 0,
      })
      .eq('user_id', user.id)
      .select()
      .single()
    setBusy(false)
    if (error) return setErr(error.message)
    setSettings(data)
    flash('Targets saved.')
  }

  async function addAccount(e) {
    e.preventDefault()
    if (!newAccount.name.trim()) return
    const { error } = await supabase.from('accounts').insert({
      user_id: user.id,
      name: newAccount.name.trim(),
      broker: newAccount.broker.trim() || null,
      starting_balance: Number(newAccount.starting_balance) || 0,
    })
    if (error) return setErr(error.message)
    setNewAccount({ name: '', broker: '', starting_balance: '' })
    reloadAccounts()
    flash('Account added.')
  }

  async function removeAccount(id) {
    await supabase.from('accounts').delete().eq('id', id)
    reloadAccounts()
  }

  async function changePassword(e) {
    e.preventDefault()
    setErr('')
    if (pw.next.length < 8) return setErr('Password must be at least 8 characters.')
    if (pw.next !== pw.confirm) return setErr('Passwords do not match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw.next })
    setBusy(false)
    if (error) return setErr(error.message)
    setPw({ next: '', confirm: '' })
    flash('Password updated.')
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <Alert kind="ok">{msg}</Alert>
      <Alert kind="error">{err}</Alert>

      <Card title="Profile">
        <form className="col" onSubmit={saveProfile} style={{ gap: 12 }}>
          <div className="grid grid-2">
            <Field label="Display name">
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email">
              <input value={user?.email || ''} disabled />
            </Field>
          </div>
          <div className="small faint">
            Your display name is the only thing other traders see, and only next to entries
            you choose to share. You can also sign in with it instead of your email, so it
            has to be unique.
          </div>
          <div><button className="btn-primary" disabled={busy}>Save profile</button></div>
        </form>
      </Card>

      <Card title="Targets & risk limits">
        <form className="col" onSubmit={saveGoals} style={{ gap: 12 }}>
          <div className="grid grid-3">
            <Field label="Weekly P&L goal">
              <input type="number" step="any" value={goals.weekly_goal}
                     onChange={(e) => setGoals({ ...goals, weekly_goal: e.target.value })} />
            </Field>
            <Field label="Weekly max loss">
              <input type="number" step="any" value={goals.weekly_max_loss}
                     onChange={(e) => setGoals({ ...goals, weekly_max_loss: e.target.value })} />
            </Field>
            <Field label="Daily max loss">
              <input type="number" step="any" value={goals.daily_max_loss}
                     onChange={(e) => setGoals({ ...goals, daily_max_loss: e.target.value })} />
            </Field>
          </div>
          <div className="small faint">
            Enter loss limits as positive numbers. The dashboard warns you when you reach them.
          </div>
          <div><button className="btn-primary" disabled={busy}>Save targets</button></div>
        </form>
      </Card>

      <Card title="Trading accounts">
        {accounts.length === 0 ? (
          <Empty icon="◈" title="No accounts yet" hint="Add one to track evaluations and funded accounts separately." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Broker</th><th className="right">Starting balance</th><th></th></tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td className="muted small">{a.broker || '—'}</td>
                    <td className="right mono">{money(a.starting_balance)}</td>
                    <td className="right">
                      <DeleteButton onDelete={() => removeAccount(a.id)} label="Remove" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form className="row-wrap mt" onSubmit={addAccount} style={{ gap: 10, alignItems: 'flex-end' }}>
          <div style={{ minWidth: 150 }} className="grow">
            <Field label="Account name">
              <input value={newAccount.name} placeholder="Topstep 50k Combine"
                     onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })} />
            </Field>
          </div>
          <div style={{ minWidth: 130 }}>
            <Field label="Broker">
              <input value={newAccount.broker} placeholder="Topstep"
                     onChange={(e) => setNewAccount({ ...newAccount, broker: e.target.value })} />
            </Field>
          </div>
          <div style={{ minWidth: 130 }}>
            <Field label="Starting balance">
              <input type="number" step="any" value={newAccount.starting_balance}
                     onChange={(e) => setNewAccount({ ...newAccount, starting_balance: e.target.value })} />
            </Field>
          </div>
          <button className="btn-primary" disabled={!newAccount.name.trim()}>Add account</button>
        </form>
      </Card>

      <Card title="Tags" action={<button className="btn-sm btn-ghost" onClick={reloadTags}>Refresh</button>}>
        {tags.length === 0 ? (
          <Empty icon="◇" title="No tags yet" hint="Tags are created as you type them on a trade or journal entry." />
        ) : (
          KINDS.map((k) => {
            const group = tags.filter((t) => t.kind === k.value)
            if (!group.length) return null
            return (
              <div key={k.value} style={{ marginBottom: 12 }}>
                <div className="tiny faint" style={{ marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  {k.label}
                </div>
                <div className="row-wrap" style={{ gap: 6 }}>
                  {group.map((t) => (
                    <TagChip key={t.id} tag={t} onRemove={() => deleteTag(t.id)} />
                  ))}
                </div>
              </div>
            )
          })
        )}
        <div className="small faint">
          Removing a tag also removes it from every trade and entry it was on.
        </div>
      </Card>

      <Card title="Password">
        <form className="col" onSubmit={changePassword} style={{ gap: 12 }}>
          <div className="grid grid-2">
            <Field label="New password">
              <input type="password" value={pw.next} autoComplete="new-password"
                     onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            </Field>
            <Field label="Confirm">
              <input type="password" value={pw.confirm} autoComplete="new-password"
                     onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </Field>
          </div>
          <div><button className="btn-primary" disabled={busy || !pw.next}>Update password</button></div>
        </form>
      </Card>

      <Card title="Session">
        <button onClick={signOut}>Sign out</button>
      </Card>
    </div>
  )
}
