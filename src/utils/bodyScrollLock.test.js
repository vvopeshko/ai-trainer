import { describe, expect, it } from 'vitest'
import { lockBodyScroll } from './bodyScrollLock.js'

describe('overlay body scroll ownership', () => {
  it('unlocks after the editor closes before its confirmation sheet', () => {
    const body = { style: { overflow: '' } }
    const closeEditor = lockBodyScroll(body)
    const closeConfirmation = lockBodyScroll(body)
    closeEditor()
    expect(body.style.overflow).toBe('hidden')
    closeConfirmation()
    expect(body.style.overflow).toBe('')
  })

  it('keeps the background locked when a nested sheet closes first', () => {
    const body = { style: { overflow: 'auto' } }
    const closeOuter = lockBodyScroll(body)
    const closeInner = lockBodyScroll(body)
    closeInner()
    expect(body.style.overflow).toBe('hidden')
    closeOuter()
    expect(body.style.overflow).toBe('auto')
  })

  it('releases once and supports a new opening after cleanup', () => {
    const body = { style: { overflow: '' } }
    const release = lockBodyScroll(body)
    release()
    const next = lockBodyScroll(body)
    release()
    expect(body.style.overflow).toBe('hidden')
    next()
    expect(body.style.overflow).toBe('')
  })
})
