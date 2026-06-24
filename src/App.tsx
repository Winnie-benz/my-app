import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import ToastHost from './components/ToastHost'
import { useAuthStore } from './store/useAuthStore'

export default function App() {
  const initialize = useAuthStore(s => s.initialize)
  const initialized = useAuthStore(s => s.initialized)

  useEffect(() => {
    void initialize()
  }, [initialize])

  if (!initialized) {
    return (
      <>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">
          กำลังโหลดระบบ...
        </div>
        <ToastHost />
      </>
    )
  }

  return (
    <>
      <RouterProvider router={router} />
      <ToastHost />
    </>
  )
}
