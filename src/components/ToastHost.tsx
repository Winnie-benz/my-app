import { useEffect, useState } from 'react'
import type { NotifyDetail } from '../utils/notify'

type Toast = NotifyDetail & { id: number }

const TOAST_CLASS: Record<NotifyDetail['type'], string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
}

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    function onNotify(event: Event) {
      const detail = (event as CustomEvent<NotifyDetail>).detail
      const id = Date.now() + Math.random()
      setToasts(items => [...items, { id, ...detail }].slice(-3))
      window.setTimeout(() => {
        setToasts(items => items.filter(item => item.id !== id))
      }, 4200)
    }

    window.addEventListener('app-notify', onNotify)
    return () => window.removeEventListener('app-notify', onNotify)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[80] w-80 max-w-[calc(100vw-2rem)] space-y-2">
      {toasts.map(t => (
        <div key={t.id} className={`border rounded-xl px-4 py-3 text-sm shadow-lg ${TOAST_CLASS[t.type]}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
