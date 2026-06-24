import { useEffect, useState, useRef } from 'react'
import { Clock, LogOut, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'

function getSecondsLeft(sessionExpiresAt: string | null): number {
  if (!sessionExpiresAt) return 0
  return Math.floor((new Date(sessionExpiresAt).getTime() - Date.now()) / 1000)
}

export default function SessionTimeoutWarning() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const sessionExpiresAt = useAuthStore(s => s.sessionExpiresAt)
  const logout        = useAuthStore(s => s.logout)
  const setSession    = useAuthStore(s => s.setSession)
  const [show, setShow]           = useState(false)
  const [secondsLeft, setSeconds] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const didAutoLogout = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || !sessionExpiresAt) return

    const tick = () => {
      const secs = getSecondsLeft(sessionExpiresAt)
      setSeconds(secs)

      if (secs <= 0 && !didAutoLogout.current) {
        didAutoLogout.current = true
        void logout()
        return
      }

      if (secs > 0 && secs <= 5 * 60) setShow(true)
      else setShow(false)
    }

    tick()
    const id = setInterval(tick, 10_000)
    return () => clearInterval(id)
  }, [isAuthenticated, sessionExpiresAt, logout])

  async function handleRefresh() {
    if (!isAuthenticated) return
    setRefreshing(true)
    try {
      const res  = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success && data.user) {
        setSession(data.user, data.session_expires_at ?? null)
        didAutoLogout.current = false
        setShow(false)
      }
    } catch { /* ignore */ }
    setRefreshing(false)
  }

  if (!show) return null

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 pb-8">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <Clock size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Session ใกล้หมดอายุ</p>
            <p className="text-xs text-slate-500">
              เหลือเวลา{' '}
              <span className="font-semibold text-amber-600">
                {mins > 0 ? `${mins} นาที ` : ''}{secs} วินาที
              </span>
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          ถ้าไม่ต่ออายุ ระบบจะออกจากระบบอัตโนมัติ
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={logout}
            className="flex-1 flex items-center justify-center gap-2 border border-slate-200 rounded-xl py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <LogOut size={14} />
            ออกจากระบบ
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'กำลังต่ออายุ...' : 'ต่ออายุ Session'}
          </button>
        </div>
      </div>
    </div>
  )
}
