import { create } from 'zustand'
import type { AuthUser } from '../types/auth'

interface SessionPayload {
  user: AuthUser
  session_expires_at: string | null
}

interface AuthStore {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  initialized: boolean
  error: string | null
  sessionExpiresAt: string | null
  initialize: () => Promise<void>
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  clearError: () => void
  clearSession: () => void
  setSession: (user: AuthUser, sessionExpiresAt: string | null) => void
  refreshIfNeeded: () => Promise<void>
}

let refreshPromise: Promise<void> | null = null

function sessionRemainingMs(sessionExpiresAt: string | null): number {
  if (!sessionExpiresAt) return 0
  const diff = new Date(sessionExpiresAt).getTime() - Date.now()
  return Number.isFinite(diff) ? diff : 0
}

async function authRequest(path: string, options: RequestInit = {}) {
  return fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })
}

export const useAuthStore = create<AuthStore>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  initialized: false,
  error: null,
  sessionExpiresAt: null,

  setSession(user, sessionExpiresAt) {
    set({
      user,
      isAuthenticated: true,
      sessionExpiresAt,
      initialized: true,
      isLoading: false,
      error: null,
    })
  },

  clearSession() {
    set({
      user: null,
      isAuthenticated: false,
      sessionExpiresAt: null,
      initialized: true,
      isLoading: false,
    })
  },

  async initialize() {
    if (get().initialized || get().isLoading) return

    set({ isLoading: true, error: null })
    try {
      const res = await authRequest('/api/auth/me')
      const data = await res.json().catch(() => ({})) as { success?: boolean } & Partial<SessionPayload>

      if (res.ok && data.success && data.user) {
        get().setSession(data.user, data.session_expires_at ?? null)
        return
      }
    } catch {
      // treat as signed out
    }

    set({
      user: null,
      isAuthenticated: false,
      sessionExpiresAt: null,
      initialized: true,
      isLoading: false,
    })
  },

  async login(username, password) {
    set({ isLoading: true, error: null })
    try {
      const res = await authRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (!data.success || !data.user) {
        set({
          isLoading: false,
          initialized: true,
          error: data.error ?? 'Login failed',
        })
        return false
      }

      get().setSession(data.user, data.session_expires_at ?? null)
      return true
    } catch {
      set({
        isLoading: false,
        initialized: true,
        error: 'Cannot connect to server. Please try again.',
      })
      return false
    }
  },

  async logout() {
    try {
      await authRequest('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore network errors and clear local session anyway
    }
    get().clearSession()
    set({ error: null })
  },

  clearError() {
    set({ error: null })
  },

  async refreshIfNeeded() {
    if (!get().isAuthenticated) return
    if (sessionRemainingMs(get().sessionExpiresAt) > 30 * 60 * 1000) return
    if (refreshPromise) return refreshPromise

    refreshPromise = (async () => {
      try {
        const res = await authRequest('/api/auth/refresh', { method: 'POST' })
        const data = await res.json().catch(() => ({})) as { success?: boolean } & Partial<SessionPayload>

        if (res.ok && data.success && data.user) {
          get().setSession(data.user, data.session_expires_at ?? null)
          return
        }

        if (res.status === 401 && sessionRemainingMs(get().sessionExpiresAt) <= 0) {
          get().clearSession()
        }
      } catch {
        // keep current session until server proves it invalid
      } finally {
        refreshPromise = null
      }
    })()

    return refreshPromise
  },
}))
