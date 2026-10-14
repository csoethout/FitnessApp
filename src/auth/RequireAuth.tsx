import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthProvider'

export function RequireAuth() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="grid h-full place-items-center text-muted">Loading…</div>
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  return <Outlet />
}
