import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ROUTES } from '@/shared/constants'
import logo from '@/assets/logo-centriparts.png'
import CartIconButton from '@/modules/cart/components/CartIconButton'

const NAV_LINKS = [
  { label: 'Inicio',     to: ROUTES.PUBLIC_HOME     },
  { label: 'Catálogo',   to: ROUTES.PUBLIC_CATALOG  },
  { label: 'Nosotros',   to: ROUTES.PUBLIC_ABOUT    },
  { label: 'Contacto',   to: ROUTES.PUBLIC_CONTACT  },
  { label: 'Mi pedido',  to: ROUTES.PUBLIC_TRACKING },
]

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <line x1="4" y1="6"  x2="20" y2="6"  />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
      <line x1="5" y1="5"  x2="19" y2="19" />
      <line x1="19" y1="5" x2="5"  y2="19" />
    </svg>
  )
}

export default function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/95 backdrop-blur-sm">

      {/* ── Main bar ──────────────────────────────────────────────────── */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 sm:py-4">

        {/* Brand */}
        <Link
          to={ROUTES.PUBLIC_HOME}
          className="shrink-0 transition-opacity hover:opacity-75"
        >
          <img
            src={logo}
            alt="Centriparts"
            className="h-14 w-auto object-contain sm:h-16"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === ROUTES.PUBLIC_HOME}
              className={({ isActive }) =>
                [
                  'text-sm font-medium transition-colors',
                  isActive
                    ? 'text-yellow-600'
                    : 'text-zinc-500 hover:text-zinc-900',
                ].join(' ')
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Link
            to={ROUTES.PUBLIC_CATALOG}
            className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-yellow-500"
          >
            <span className="hidden sm:inline">Ver catálogo</span>
            <span className="sm:hidden">Catálogo</span>
          </Link>

          <CartIconButton />

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 md:hidden"
          >
            {mobileOpen ? <CloseIcon /> : <HamburgerIcon />}
          </button>
        </div>

      </div>

      {/* ── Mobile menu ───────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="border-t border-zinc-100 bg-white md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === ROUTES.PUBLIC_HOME}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  [
                    'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-yellow-50 text-yellow-600'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

    </header>
  )
}
