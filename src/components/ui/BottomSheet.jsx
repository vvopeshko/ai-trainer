import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Bottom Sheet — модалка снизу экрана.
 * Анимация открытия/закрытия, backdrop, Glass-стиль.
 */
export function BottomSheet({ open, onClose, children }) {
  const sheetRef = useRef(null)
  // Таймеры анимации закрытия храним в ref, чтобы очищать в cleanup эффекта /
  // при анмаунте — иначе setTimeout мог выстрелить setState на размонтированном
  // компоненте.
  const closeTimerRef = useRef(null)
  // visible = рендерим DOM, closing = проигрываем анимацию выхода
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  const DURATION = 250 // ms — совпадает с CSS

  // Открытие / программное закрытие
  useEffect(() => {
    if (open) {
      setClosing(false)
      setVisible(true)
    } else if (visible && !closing) {
      setClosing(true)
      closeTimerRef.current = setTimeout(() => {
        setVisible(false)
        setClosing(false)
      }, DURATION)
    }
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Закрытие с анимацией
  const handleClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    closeTimerRef.current = setTimeout(() => {
      setVisible(false)
      setClosing(false)
      onClose()
    }, DURATION)
  }, [closing, onClose])

  // Escape
  useEffect(() => {
    if (!visible) return
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [visible, handleClose])

  // Lock body scroll
  useEffect(() => {
    if (!visible) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [visible])

  // Базовый focus trap: при открытии переводим фокус на первый интерактивный
  // элемент шита (или сам контейнер), чтобы клавиатура/скринридер попали внутрь.
  useEffect(() => {
    if (!open || !visible) return
    const el = sheetRef.current
    if (!el) return
    const focusable = el.querySelector(
      'button, a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
    )
    ;(focusable || el).focus?.()
  }, [open, visible])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '0 8px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          animation: closing
            ? `bsBackdropOut ${DURATION}ms ease-in forwards`
            : `bsBackdropIn ${DURATION}ms ease-out`,
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        style={{
          position: 'relative',
          outline: 'none',
          background: 'var(--surface-0, rgba(20,30,28,0.92))',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '20px 20px 0 0',
          padding: '12px var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-5))',
          maxHeight: '80vh',
          overflowY: 'auto',
          animation: closing
            ? `bsSlideDown ${DURATION}ms ease-in forwards`
            : `bsSlideUp ${DURATION}ms ease-out`,
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 36,
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.2)',
          margin: '0 auto var(--space-4)',
        }} />

        {children}
      </div>

      <style>{`
        @keyframes bsBackdropIn {
          from { opacity: 0 }
          to { opacity: 1 }
        }
        @keyframes bsBackdropOut {
          from { opacity: 1 }
          to { opacity: 0 }
        }
        @keyframes bsSlideUp {
          from { transform: translateY(100%) }
          to { transform: translateY(0) }
        }
        @keyframes bsSlideDown {
          from { transform: translateY(0) }
          to { transform: translateY(100%) }
        }
      `}</style>
    </div>
  )
}
