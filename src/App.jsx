import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import TabLayout from './components/layout/TabLayout.jsx'
import HomePage from './pages/Main/HomePage.jsx'
import WorkoutPage from './pages/Main/WorkoutPage.jsx'

const ProgressPage = lazy(() => import('./pages/Main/ProgressPage.jsx'))
const SummaryPage = lazy(() => import('./pages/Main/SummaryPage.jsx'))
const ProgramEditPage = lazy(() => import('./pages/Main/ProgramEditPage.jsx'))
const DesignSystemDemo = lazy(() => import('./pages/Demo/DesignSystemDemo.jsx'))

function StubPage({ title }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--fg-tertiary)', fontSize: 'var(--text-sm)',
    }}>
      {title} — скоро
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--fg-primary)' }}>
      <Routes>
        {/* Tab screens */}
        <Route path="/" element={<TabLayout><HomePage /></TabLayout>} />
        <Route path="/progress" element={<TabLayout><Suspense fallback={null}><ProgressPage /></Suspense></TabLayout>} />
        <Route path="/library" element={<TabLayout><StubPage title="Каталог" /></TabLayout>} />
        <Route path="/me" element={<TabLayout><StubPage title="Профиль" /></TabLayout>} />

        {/* Full-screen flows */}
        <Route path="/workout" element={<WorkoutPage />} />
        <Route path="/program/:id" element={<Suspense fallback={null}><ProgramEditPage /></Suspense>} />
        <Route path="/summary/:id" element={<Suspense fallback={null}><SummaryPage /></Suspense>} />
        <Route path="/demo" element={<Suspense fallback={null}><DesignSystemDemo /></Suspense>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm opacity-60">404 — страница не найдена</p>
    </div>
  )
}
