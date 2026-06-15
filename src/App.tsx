import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import ToastHost from './components/ToastHost'

export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <ToastHost />
    </>
  )
}
