/**
 * SwipeRow — swipe-to-delete обёртка.
 * Используется в WorkoutPage и ProgressPage.
 */
import { useRef, useCallback } from 'react'
import { Icon } from './Icon.jsx'

const DEFAULT_DELETE_WIDTH = 72

export function SwipeRow({ children, onDelete, deleteWidth = DEFAULT_DELETE_WIDTH }) {
  const trackRef = useRef(null)
  const startX = useRef(0)
  const currentX = useRef(0)
  const opened = useRef(false)

  const handleTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX
    currentX.current = opened.current ? -deleteWidth : 0
  }, [deleteWidth])

  const handleTouchMove = useCallback((e) => {
    const dx = e.touches[0].clientX - startX.current
    let offset = opened.current ? dx - deleteWidth : dx
    offset = Math.min(0, Math.max(-deleteWidth - 20, offset))

    if (trackRef.current) {
      trackRef.current.style.transition = 'none'
      trackRef.current.style.transform = `translateX(${offset}px)`
    }
    currentX.current = offset
  }, [deleteWidth])

  const handleTouchEnd = useCallback(() => {
    if (!trackRef.current) return
    trackRef.current.style.transition = 'transform 0.25s ease-out'

    if (currentX.current < -deleteWidth / 2) {
      trackRef.current.style.transform = `translateX(-${deleteWidth}px)`
      opened.current = true
    } else {
      trackRef.current.style.transform = 'translateX(0)'
      opened.current = false
    }
  }, [deleteWidth])

  return (
    <div style={{ overflow: 'hidden' }}>
      <div
        ref={trackRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'flex',
          transition: 'transform 0.25s ease-out',
        }}
      >
        <div style={{ flex: '0 0 100%', minWidth: 0 }}>
          {children}
        </div>
        <div
          onClick={onDelete}
          style={{
            flex: `0 0 ${deleteWidth}px`,
            background: 'var(--danger, hsl(0,65%,50%))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Icon name="trash" size={18} style={{ color: '#fff' }} />
        </div>
      </div>
    </div>
  )
}
