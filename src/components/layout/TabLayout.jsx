import { useLocation, useNavigate } from 'react-router-dom'
import { Mesh } from '../ui/Mesh.jsx'
import { GlassNav } from '../ui/GlassNav.jsx'

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

export default function TabLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()

  const active = TAB_MAP[location.pathname] || 'home'

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
    }}>
      <Mesh />
      <div style={{
        position: 'relative',
        zIndex: 1,
        paddingTop: 'var(--safe-top, 0px)',
        paddingBottom: 'calc(80px + var(--safe-bottom, 0px))',
        minHeight: '100vh',
      }}>
        {children}
      </div>
      <GlassNav
        active={active}
        onNav={(key) => navigate(ROUTE_MAP[key])}
      />
    </div>
  )
}
