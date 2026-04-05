import { Link } from 'react-router-dom'
import { ROUTES } from '@/shared/constants'
import logo from '@/assets/logo-centriparts.png'

const FOOTER_SECTIONS = [
  {
    title: 'Catálogo',
    links: [
      { label: 'Todos los productos', to: ROUTES.PUBLIC_CATALOG },
      { label: 'Sensores',            to: ROUTES.PUBLIC_CATALOG },
      { label: 'Bombas de agua',      to: ROUTES.PUBLIC_CATALOG },
      { label: 'Filtros',             to: ROUTES.PUBLIC_CATALOG },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Nosotros',          to: ROUTES.PUBLIC_ABOUT   },
      { label: 'Misión y valores',  to: ROUTES.PUBLIC_ABOUT   },
      { label: 'Trabaja con nosotros', to: ROUTES.PUBLIC_CONTACT },
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
                alt="Centriparts"
                className="h-14 w-auto object-contain brightness-0 invert"
              />
            </Link>
            <p className="text-sm leading-relaxed">
              Distribuidores de repuestos automotrices con amplia experiencia en el mercado colombiano.
            </p>
            <div className="flex flex-col gap-1 text-sm">
              <a
                href="mailto:info@centriparts.com"
                className="transition-colors hover:text-white"
              >
                info@centriparts.com
              </a>
              <a
                href="tel:+573001234567"
                className="transition-colors hover:text-white"
              >
                +57 300 123 4567
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
