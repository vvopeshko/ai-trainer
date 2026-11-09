import { useEffect, useState } from 'react'

// iOS keeps the layout viewport full-height when the keyboard opens. Fit
// exercise overlays to the visible area, without disabling browser zoom.
export function useOverlayViewport(open) {
  const [viewport, setViewport] = useState(null)
  useEffect(() => {
    const visual = window.visualViewport
    if (!open || !visual) return
    const update = () => {
      if (visual.scale !== 1) return
      setViewport({ top: visual.offsetTop, height: visual.height })
    }
    update()
    visual.addEventListener('resize', update)
    visual.addEventListener('scroll', update)
    return () => {
      visual.removeEventListener('resize', update)
      visual.removeEventListener('scroll', update)
    }
  }, [open])
  return viewport ? { top: viewport.top, height: viewport.height, bottom: 'auto' } : {}
}
