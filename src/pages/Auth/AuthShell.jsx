import { Glass } from '../../components/ui/index.js'

// Общий каркас страниц /login и /auth/*: тёмный фон, центрированная колонка,
// Glass-карточка. Web-only код — грузится лениво, в бандл мини-аппа не попадает.

export function AuthShell({ children }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        background: 'var(--bg-base)',
        color: 'var(--fg-primary)',
      }}
    >
      <Glass variant="strong" specular radius={20} padding="var(--space-6)" style={{ width: '100%', maxWidth: 400 }}>
        {children}
      </Glass>
    </div>
  )
}

export function AuthInput({ label, ...rest }) {
  return (
    <label style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
      <span
        style={{
          display: 'block',
          fontSize: 'var(--text-xs)',
          color: 'var(--fg-tertiary)',
          marginBottom: 'var(--space-1)',
        }}
      >
        {label}
      </span>
      <input
        style={{
          width: '100%',
          height: 44,
          padding: '0 14px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.06)',
          color: 'var(--fg-primary)',
          fontSize: 'var(--text-sm)',
          outline: 'none',
        }}
        {...rest}
      />
    </label>
  )
}

export function AuthError({ children }) {
  if (!children) return null
  return (
    <p
      style={{
        margin: '0 0 var(--space-3)',
        fontSize: 'var(--text-xs)',
        color: 'var(--danger)',
        lineHeight: 1.4,
      }}
    >
      {children}
    </p>
  )
}

export function AuthNote({ children }) {
  if (!children) return null
  return (
    <p
      style={{
        margin: '0 0 var(--space-3)',
        fontSize: 'var(--text-xs)',
        color: 'var(--fg-secondary)',
        lineHeight: 1.4,
      }}
    >
      {children}
    </p>
  )
}
