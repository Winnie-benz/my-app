import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AuthUser } from '../types/auth'

interface AuthStore {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
  refreshIfNeeded: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    set => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      async login(username, password) {
        set({ isLoading: true, error: null })
        try {
          const res  = await fetch('/api/auth/login', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username, password }),
          })
          const data = await res.json()

          if (!data.success) {
            set({ isLoading: false, error: data.error ?? 'Login failed' })
            return false
          }

          set({
            token:           data.token,
            user:            data.user,
            isAuthenticated: true,
            isLoading:       false,
            error:           null,
          })
          return true
        } catch {
          set({ isLoading: false, error: 'Cannot connect to server. Please try again.' })
          return false
        }
      },

      logout() {
        set({ token: null, user: null, isAuthenticated: false, error: null })
      },

      clearError() {
        set({ error: null })
      },

      async refreshIfNeeded() {
        const { token } = useAuthStore.getState()
        if (!token) return
        try {
          const payload = JSON.parse(atob(token.split('.')[1]))
          const expiresIn = payload.exp * 1000 - Date.now()
          if (expiresIn > 30 * 60 * 1000) return  // more than 30 min left → skip
          const res  = await fetch('/api/auth/refresh', {
            method:  'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
          const data = await res.json()
          if (data.success && data.token) set({ token: data.token })
        } catch { /* silent — token still valid for now */ }
      },
    }),
    {
      name:       'auth',
      storage:    createJSONStorage(() => localStorage),
      // Only persist auth state — not loading/error
      partialize: s => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
)
