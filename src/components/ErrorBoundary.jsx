import { Component } from 'react'

/**
 * A thrown render error unmounts the whole tree and leaves a blank screen,
 * which is indistinguishable from "the button did nothing". This catches it
 * and shows what actually broke.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('[trading-journal]', error, info?.componentStack)
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div className="crash">
        <div className="card col" style={{ gap: 12, maxWidth: 620 }}>
          <h2>Something broke on this screen</h2>
          <div className="small muted">
            The rest of the app is fine — this is the error so it can be fixed
            rather than silently showing nothing.
          </div>
          <pre className="crash-detail">{String(error?.message || error)}</pre>
          {info?.componentStack && (
            <details>
              <summary className="small muted" style={{ cursor: 'pointer' }}>
                Where it happened
              </summary>
              <pre className="crash-detail">{info.componentStack.trim()}</pre>
            </details>
          )}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn-primary" onClick={() => this.setState({ error: null, info: null })}>
              Try again
            </button>
            <button className="btn-ghost" onClick={() => window.location.assign('/')}>
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }
}
