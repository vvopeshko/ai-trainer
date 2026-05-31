/**
 * Toast — auto-dismiss уведомление.
 *
 * Использование:
 *   const toast = useToast()
 *   toast.show('Ошибка сети')
 *   toast.show('Сохранено', 'success')
 *
 * Обёртка <ToastProvider> в main.jsx:
 *   <ToastProvider><App /></ToastProvider>
 */
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

const ToastContext = createContext()

const DURATION = 3000

const variantColors = {
  error: 'var(--danger, hsl(0,65%,50%))',
  success: 'var(--success, hsl(158,64%,42%))',
  info: 'var(--fg-secondary)',
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const show = useCallback((message, variant = 'error') => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ message, variant, key: Date.now() })
    timerRef.current = setTimeout(() => setToast(null), DURATION)
  }, [])

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          key={toast.key}
          onClick={() => { setToast(null); if (timerRef.current) clearTimeout(timerRef.current) }}
          style={{
            position: 'fixed',
            bottom: 'calc(var(--safe-bottom, 0px) + 80px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            maxWidth: 'calc(100vw - 32px)',
            padding: '10px 18px',
            borderRadius: 12,
            background: 'rgba(22,22,28,0.88)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: `1px solid ${variantColors[toast.variant] || variantColors.info}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            fontSize: 'var(--text-sm)',
            color: 'var(--fg-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            animation: 'toast-in 0.25s ease-out',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: variantColors[toast.variant] || variantColors.info,
            flexShrink: 0,
          }} />
          {toast.message}
        </div>
      )}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast requires <ToastProvider>')
  return ctx
}
