import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AURA] error capturado', error, info)
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: "'Inter', system-ui, sans-serif",
          color: 'var(--text)',
          background: 'var(--bg)',
          padding: 24,
        }}>
          <div style={{
            maxWidth: 380,
            textAlign: 'center',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 28,
            boxShadow: 'var(--shadow-1)',
          }}>
            <div style={{
              fontSize: 30, fontWeight: 800, letterSpacing: '0.06em', marginBottom: 6,
            }}>
              AURA
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.6 }}>
              Algo salió mal y la señal se cortó. Recargá la página para volver al estudio.
            </p>
            <button
              onClick={() => {
                this.setState({ error: null })
                window.location.reload()
              }}
              style={{
                marginTop: 18,
                border: 0,
                padding: '10px 22px',
                borderRadius: 10,
                background: 'var(--grad-cta)',
                color: '#06121a',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 13,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Recargar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}