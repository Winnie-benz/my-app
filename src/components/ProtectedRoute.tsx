import { useMemo, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import type { Role } from '../types/auth'

interface Props {
  children: React.ReactNode
  requiredRole?: Role
}

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { isAuthenticated, token, user, logout } = useAuthStore()

  const expired = useMemo(
    () => Boolean(token && isExpired(token)),
    [token],
  )

  // Clear stale auth state after render
  useEffect(() => {
    if (expired) logout()
  }, [expired, logout])

  if (!isAuthenticated || expired) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole === 'admin' && user?.role !== 'admin') {
    return <Navigate to="/stock" replace />
  }

  return <>{children}</>
}
