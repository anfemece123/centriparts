import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROUTES } from '@/shared/constants'
import logo from '@/assets/logo-centriparts.png'

export default function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // While resolving initial session, show nothing to avoid flash
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <span className="text-sm text-zinc-400">Cargando…</span>
      </div>
    )
  }

  // Already signed in — send directly to admin dashboard
  if (user) {
    return <Navigate to={ROUTES.ADMIN_HOME} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await signIn(email.trim(), password)
      navigate(ROUTES.ADMIN_HOME, { replace: true })
    } catch {
      setError('Correo o contraseña incorrectos.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img src={logo} alt="Centriparts" className="h-14 w-auto object-contain" />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-8 shadow-sm">

          <div className="mb-6">
            <h1 className="text-xl font-bold text-zinc-900">Panel de administración</h1>
            <p className="mt-1 text-sm text-zinc-400">Ingrese sus credenciales para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-zinc-700">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="admin@centriparts.com"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-zinc-700">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="••••••••"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="mt-1 rounded-lg bg-yellow-400 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Ingresando…' : 'Ingresar'}
            </button>

          </form>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          © {new Date().getFullYear()} Centriparts
        </p>

      </div>
    </div>
  )
}
