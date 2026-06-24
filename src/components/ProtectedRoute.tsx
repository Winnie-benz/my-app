import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import type { Role } from '../types/auth'

interface Props {
  children: React.ReactNode
  requiredRole?: Role
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { initialized, isAuthenticated, user } = useAuthStore()

  if (!initialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        กำลังตรวจสอบ session...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole === 'admin' && user?.role !== 'admin') {
    return <Navigate to="/stock" replace />
  }

  return <>{children}</>
}
