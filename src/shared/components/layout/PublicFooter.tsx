import { Link } from 'react-router-dom'
import { ROUTES } from '@/shared/constants'
import logo from '@/assets/logo-centriparts.png'

const FOOTER_SECTIONS = [
  {
    title: 'Catálogo',
    links: [
      { label: 'Todos los productos', to: ROUTES.PUBLIC_CATALOG },
      { label: 'Sensores',            to: ROUTES.PUBLIC_CATALOG },
      { label: 'Componentes eléctricos', to: ROUTES.PUBLIC_CATALOG },
      { label: 'Componentes electrónicos', to: ROUTES.PUBLIC_CATALOG },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Nosotros',          to: ROUTES.PUBLIC_ABOUT   },
      { label: 'Misión y valores',  to: ROUTES.PUBLIC_ABOUT   },
      { label: 'Asesoría especializada', to: ROUTES.PUBLIC_CONTACT },
    ],
  },
  {
    title: 'Ayuda',
    links: [
      { label: 'Preguntas frecuentes', to: ROUTES.PUBLIC_CONTACT },
      { label: 'Garantías',            to: ROUTES.PUBLIC_CONTACT },
      { label: 'Envíos y entrega',     to: ROUTES.PUBLIC_CONTACT },
    ],
  },
]

export default function PublicFooter() {
  return (
    <footer className="border-t border-zinc-100 bg-zinc-900 text-zinc-400">
      <div className="mx-auto max-w-6xl px-6 py-14">

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Brand column */}
          <div className="flex flex-col gap-4">
            <Link to={ROUTES.PUBLIC_HOME} className="transition-opacity hover:opacity-75">
              <img
                src={logo}
                alt="Centriparts, especialistas en componentes eléctricos y electrónicos"
                className="h-14 w-auto object-contain brightness-0 invert"
              />
            </Link>
            <p className="text-sm leading-relaxed">
              Especialistas en componentes eléctricos y electrónicos para vehículos, con atención
              personalizada y orientación en la búsqueda de referencias.
            </p>
            <div className="flex flex-col gap-1 text-sm">
              <a
                href="mailto:centripartsjed@outlook.es"
                className="transition-colors hover:text-white"
              >
                centripartsjed@outlook.es
              </a>
              <a
                href="tel:+573503160713"
                className="transition-colors hover:text-white"
              >
                +57 350 316 0713
              </a>
            </div>
          </div>

          {/* Link sections */}
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                {section.title}
              </span>
              <ul className="flex flex-col gap-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-zinc-800 pt-6 text-center text-xs text-zinc-600">
          © {new Date().getFullYear()} Centriparts. Todos los derechos reservados.
        </div>

      </div>
    </footer>
  )
}
