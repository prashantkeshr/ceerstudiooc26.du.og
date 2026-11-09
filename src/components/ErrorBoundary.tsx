import { Component, type ReactNode } from 'react';

// Catches render/runtime errors in any feature so a single crash shows a
// recovery screen instead of a blank page. The user's work lives in IndexedDB,
// so it is safe across a reload.
interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('Career Studio caught an error:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="content" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 48, textAlign: 'center' }}>
        <div className="card" style={{ padding: 28 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p className="muted">This screen hit an unexpected error. Your saved projects are safe in this browser’s local storage.</p>
          <pre style={{ textAlign: 'left', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 12, overflow: 'auto', maxHeight: 160 }}>
            {this.state.error.message}
          </pre>
          <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => { this.setState({ error: null }); location.hash = '#/'; }}>Back to dashboard</button>
            <button className="btn" onClick={() => location.reload()}>Reload app</button>
          </div>
        </div>
      </div>
    );
  }
}
