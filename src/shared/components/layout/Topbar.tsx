import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '@/shared/translations'
import { ROUTES } from '@/shared/constants'
import { useAuth } from '@/modules/auth/context/auth-context'
import { Button } from '@/shared/components/ui'

export default function Topbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      navigate(ROUTES.ADMIN_LOGIN, { replace: true })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="flex h-20 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <span className="text-sm font-semibold text-zinc-900">
        {t.home.subtitle}
      </span>

      <div className="flex items-center gap-4">
        {user && (
          <span className="hidden text-xs text-zinc-400 sm:block">
            {user.email}
          </span>
        )}
        <Button
          onClick={handleSignOut}
          disabled={signingOut}
          variant="secondary"
          size="sm"
        >
          {signingOut ? 'Saliendo…' : 'Cerrar sesión'}
        </Button>
      </div>
    </header>
  )
}
