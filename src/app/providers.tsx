import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { store } from '@/store'
import { router } from './router'
import { AuthProvider } from '@/modules/auth/context/AuthContext'

export default function Providers() {
  return (
    <Provider store={store}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </Provider>
  )
}
