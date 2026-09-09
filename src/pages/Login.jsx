import { useState } from 'react'
import { supabase, resolveLoginEmail } from '../lib/supabase'
import { Alert, Field } from '../components/ui'
import { useTitle } from '../lib/hooks'

export default function Login() {
  const [mode, setMode] = useState('signin') // signin | signup | reset
  const [identifier, setIdentifier] = useState('')  // email or display name
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useTitle(mode === 'signup' ? 'Create account' : 'Sign in')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'signin') {
        const resolved = await resolveLoginEmail(identifier)
        // An unknown display name gets the same answer as a wrong password,
        // so this cannot be used to probe which names exist.
        if (!resolved) throw new Error('Invalid login credentials')
        const { error } = await supabase.auth.signInWithPassword({
          email: resolved,
          password,
        })
        if (error) throw error
      } else if (mode === 'signup') {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.')
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() || email.split('@')[0] } },
        })
        if (error) throw error
        if (!data.session) {
          setNotice('Account created. Check your inbox to confirm the email, then sign in.')
          setMode('signin')
        }
      } else {
        const resolved = await resolveLoginEmail(identifier)
        if (!resolved) throw new Error('No account matches that email or display name.')
        const { error } = await supabase.auth.resetPasswordForEmail(resolved, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setNotice('Password reset link sent — check your email.')
      }
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: 'center', paddingBottom: 22 }}>
          <span className="brand-dot">TJ</span> Trading Journal
        </div>

        <form className="card col" onSubmit={submit} style={{ gap: 14 }}>
          <div>
            <h2>
              {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset password'}
            </h2>
            <div className="small muted" style={{ marginTop: 4 }}>
              {mode === 'signup'
                ? 'Your trades and P&L stay private to you. Only journal entries are shared.'
                : mode === 'reset'
                  ? 'We will email you a link to set a new password.'
                  : 'Sign in with your email or your display name.'}
            </div>
          </div>

          <Alert kind="error">{error}</Alert>
          <Alert kind="ok">{notice}</Alert>

          {mode === 'signup' && (
            <Field label="Display name">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How you appear in the shared journal"
                autoComplete="nickname"
              />
            </Field>
          )}

          {mode === 'signup' ? (
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </Field>
          ) : (
            <Field label="Email or display name">
              <input
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                placeholder="adam  ·  or  ·  you@example.com"
              />
            </Field>
          )}

          {mode !== 'reset' && (
            <Field label="Password">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder="••••••••"
              />
            </Field>
          )}

          <button className="btn-primary btn-block" disabled={busy} type="submit">
            {busy
              ? 'Working…'
              : mode === 'signin'
                ? 'Sign in'
                : mode === 'signup'
                  ? 'Create account'
                  : 'Send reset link'}
          </button>

          <div className="row small" style={{ justifyContent: 'space-between' }}>
            {mode === 'signin' ? (
              <>
                <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); setError('') }}>
                  Create an account
                </a>
                <a href="#" onClick={(e) => { e.preventDefault(); setMode('reset'); setError('') }}>
                  Forgot password?
                </a>
              </>
            ) : (
              <a href="#" onClick={(e) => { e.preventDefault(); setMode('signin'); setError('') }}>
                ← Back to sign in
              </a>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
