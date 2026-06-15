import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

export function useAuth() {
  const store    = useAuthStore()
  const navigate = useNavigate()

  const login = useCallback(
    async (username: string, password: string) => {
      const ok = await store.login(username, password)
      if (ok) navigate('/dashboard', { replace: true })
    },
    [store, navigate],
  )

  const logout = useCallback(() => {
    store.logout()
    navigate('/login', { replace: true })
  }, [store, navigate])

  return { ...store, login, logout }
}
