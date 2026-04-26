import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import WorkoutPage from './pages/Main/WorkoutPage.jsx'

const SummaryPage = lazy(() => import('./pages/Main/SummaryPage.jsx'))
const DesignSystemDemo = lazy(() => import('./pages/Demo/DesignSystemDemo.jsx'))

export default function App() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--fg-primary)' }}>
      <Routes>
        <Route path="/" element={<Navigate to="/workout" replace />} />
        <Route path="/workout" element={<WorkoutPage />} />
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
