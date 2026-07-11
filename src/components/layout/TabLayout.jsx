import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Mesh } from '../ui/Mesh.jsx'
import { GlassNav } from '../ui/GlassNav.jsx'
import { WebLayout } from '../web/WebLayout.jsx'
import { usePlatform } from '../../contexts/PlatformContext.jsx'

const TAB_MAP = {
  '/': 'home',
  '/progress': 'progress',
  '/library': 'lib',
  '/me': 'me',
}

const ROUTE_MAP = {
  home: '/',
  progress: '/progress',
  lib: '/library',
  me: '/me',
}

// Десктопный брейкпоинт web-версии (lg). Mini App всегда мобильный.
function useDesktop() {
  const [desktop, setDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e) => setDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return desktop
}

export default function TabLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { isWeb } = usePlatform()
  const desktop = useDesktop()

  const active = TAB_MAP[location.pathname] || 'home'
  const onNav = (key) => navigate(ROUTE_MAP[key])

  // Десктопный браузер → сайдбар слева; мобильный браузер и Mini App → нижний dock
  if (isWeb && desktop) {
    return (
      <WebLayout active={active} onNav={onNav}>
        {children}
      </WebLayout>
    )
  }

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
    }}>
      <Mesh />
      <div style={{
        position: 'relative',
        paddingTop: 'var(--safe-top, 0px)',
        paddingBottom: 'calc(96px + var(--safe-bottom, 0px))',
        minHeight: '100vh',
      }}>
        {children}
      </div>
      <GlassNav
        active={active}
        onNav={onNav}
      />
    </div>
  )
}
