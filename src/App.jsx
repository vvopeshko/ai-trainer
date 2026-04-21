import { Routes, Route, Navigate } from 'react-router-dom'
import WorkoutPage from './pages/Main/WorkoutPage.jsx'

export default function App() {
  return (
    <div className="min-h-screen bg-[#0F0F13] text-[#E8E8F0]">
      <Routes>
        <Route path="/" element={<Navigate to="/workout" replace />} />
        <Route path="/workout" element={<WorkoutPage />} />
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
