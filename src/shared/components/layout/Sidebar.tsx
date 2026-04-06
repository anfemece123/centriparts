import { NavLink } from 'react-router-dom'
import { t } from '@/shared/translations'
import { ROUTES } from '@/shared/constants'
import logo from '@/assets/logo-centriparts.png'

const navItems = [
  { label: t.nav.dashboard,  path: ROUTES.ADMIN_HOME        },
  { label: t.nav.products,   path: ROUTES.ADMIN_PRODUCTS    },
  { label: t.nav.categories, path: ROUTES.ADMIN_CATEGORIES  },
  { label: t.nav.orders,     path: ROUTES.ADMIN_ORDERS      },
]

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col bg-zinc-900">
      <div className="flex h-20 items-center px-5">
        <img
          src={logo}
          alt={t.common.appName}
          className="h-12 w-auto object-contain brightness-0 invert"
        />
      </div>

      <div className="mx-4 border-t border-zinc-800" />

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === ROUTES.ADMIN_HOME}
            className={({ isActive }) =>
              [
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-yellow-400 text-black'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white',
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
