import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROUTES } from '@/shared/constants'

export default function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <span className="text-sm text-zinc-400">Cargando…</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to={ROUTES.ADMIN_LOGIN} replace />
  }

  return <Outlet />
}
