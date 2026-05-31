import { Component } from 'react'

/**
 * React Error Boundary — ловит JS-ошибки в дереве компонентов.
 * Показывает fallback UI вместо белого экрана.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 'var(--space-6, 24px)',
        background: 'var(--bg-base, #111)',
        color: 'var(--fg-primary, #fff)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
          fontSize: 24,
        }}>
          ⚠
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          Что-то пошло не так
        </div>
        <div style={{
          fontSize: 14, color: 'var(--fg-tertiary, #888)',
          marginBottom: 24, maxWidth: 300,
        }}>
          Произошла непредвиденная ошибка. Попробуйте обновить страницу.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 24px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--accent, hsl(158,64%,42%))',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Обновить
        </button>
      </div>
    )
  }
}
