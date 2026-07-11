import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import TabLayout from './components/layout/TabLayout.jsx'
import HomePage from './pages/Main/HomePage.jsx'
import WorkoutPage from './pages/Main/WorkoutPage.jsx'
import { useExerciseSettings } from './hooks/queries.js'
import { queryClient } from './lib/queryClient.js'
import { queryKeys } from './lib/queryKeys.js'
import { apiGet } from './utils/api.js'
import { Skeleton } from './components/ui/Skeleton.jsx'

const ProgressPage = lazy(() => import('./pages/Main/ProgressPage.jsx'))
const SummaryPage = lazy(() => import('./pages/Main/SummaryPage.jsx'))
const ProgramEditPage = lazy(() => import('./pages/Main/ProgramEditPage.jsx'))
const LibraryPage = lazy(() => import('./pages/Main/LibraryPage.jsx'))
const MePage = lazy(() => import('./pages/Main/MePage.jsx'))
const DesignSystemDemo = lazy(() => import('./pages/Demo/DesignSystemDemo.jsx'))

// Web-auth страницы: lazy — в бандл мини-аппа не попадают
const LoginPage = lazy(() => import('./pages/Auth/LoginPage.jsx'))
const AuthCallback = lazy(() => import('./pages/Auth/AuthCallback.jsx'))
const ResetPasswordPage = lazy(() => import('./pages/Auth/ResetPasswordPage.jsx'))
const VerifyEmailPage = lazy(() => import('./pages/Auth/VerifyEmailPage.jsx'))

function PageSkeleton() {
  return (
    <div style={{ padding: 'var(--space-4)', maxWidth: 480, margin: '0 auto' }}>
      <Skeleton width="50%" height={24} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={120} radius={14} style={{ marginBottom: 12 }} />
      <Skeleton width="100%" height={80} radius={14} />
    </div>
  )
}

export default function App() {
  // Early sync of exercise settings from server → localStorage
  useExerciseSettings()

  // Prefetch lazy tab chunks + data during idle time
  useEffect(() => {
    const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : setTimeout
    idle(() => {
      import('./pages/Main/ProgressPage.jsx')
      import('./pages/Main/LibraryPage.jsx')
      queryClient.prefetchQuery({
        queryKey: queryKeys.progress,
        queryFn: () => apiGet('/api/v1/progress'),
      })
      queryClient.prefetchQuery({
        queryKey: queryKeys.exercises.catalog,
        queryFn: async () => {
          const d = await apiGet('/api/v1/exercises?limit=1500')
          return d.exercises || []
        },
        staleTime: 24 * 60 * 60_000,
      })
    })
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--fg-primary)' }}>
      <Routes>
        {/* Tab screens */}
        <Route path="/" element={<TabLayout><HomePage /></TabLayout>} />
        <Route path="/progress" element={<TabLayout><Suspense fallback={<PageSkeleton />}><ProgressPage /></Suspense></TabLayout>} />
        <Route path="/library" element={<TabLayout><Suspense fallback={<PageSkeleton />}><LibraryPage /></Suspense></TabLayout>} />
        <Route path="/me" element={<TabLayout><Suspense fallback={<PageSkeleton />}><MePage /></Suspense></TabLayout>} />

        {/* Full-screen flows */}
        <Route path="/workout" element={<WorkoutPage />} />
        <Route path="/program/:id" element={<Suspense fallback={<PageSkeleton />}><ProgramEditPage /></Suspense>} />
        <Route path="/summary/:id" element={<Suspense fallback={<PageSkeleton />}><SummaryPage /></Suspense>} />
        <Route path="/demo" element={<Suspense fallback={null}><DesignSystemDemo /></Suspense>} />

        {/* Web-авторизация (браузер; в Mini App не используются) */}
        <Route path="/login" element={<Suspense fallback={null}><LoginPage /></Suspense>} />
        <Route path="/auth/callback" element={<Suspense fallback={null}><AuthCallback /></Suspense>} />
        <Route path="/auth/reset" element={<Suspense fallback={null}><ResetPasswordPage /></Suspense>} />
        <Route path="/auth/verify" element={<Suspense fallback={null}><VerifyEmailPage /></Suspense>} />
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
