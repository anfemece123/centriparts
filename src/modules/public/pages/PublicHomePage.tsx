import { Link } from 'react-router-dom'
import { ROUTES } from '@/shared/constants'
import heroImage from '@/assets/hero-centriparts.png'
import { getButtonClassName } from '@/shared/components/ui'
import LocationSection from '@/modules/public/components/LocationSection'

const VALUE_PROPS = [
  {
    title: 'Compatibilidad verificada',
    description:
      'Le ayudamos a identificar el componente adecuado según la marca, línea, modelo y referencia de su vehículo.',
  },
  {
    title: 'Asesoría especializada',
    description:
      'Reciba orientación para encontrar componentes eléctricos y electrónicos de forma más segura.',
  },
  {
    title: 'Atención personalizada',
    description:
      'Consulte sus dudas y reciba acompañamiento durante la búsqueda de la referencia que necesita.',
  },
]

const STATS = [
  { label: 'Sistemas eléctricos',   value: 'Energía'      },
  { label: 'Componentes electrónicos', value: 'Control'   },
  { label: 'Aplicaciones',            value: 'Multimarca'   },
  { label: 'Atención personalizada',  value: 'Asesoría'     },
]

export default function PublicHomePage() {
  return (
    <div className="flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-24 sm:py-36"
      >
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/55" />

        {/* Content sits above the overlay */}
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-yellow-400">
            Especialistas en electricidad y electrónica automotriz
          </p>
          <h1 className="mb-6 text-3xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            Soluciones eléctricas y electrónicas<br />para su vehículo
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
            Encuentre componentes eléctricos y electrónicos para el mantenimiento y la
            reparación de su vehículo, con asesoría personalizada e información de compatibilidad.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <Link
              to={ROUTES.PUBLIC_CATALOG}
              className={getButtonClassName({ size: 'lg', className: 'w-full sm:w-auto' })}
            >
              Explorar catálogo
            </Link>
            <Link
              to={ROUTES.PUBLIC_CONTACT}
              className={getButtonClassName({
                variant: 'secondary',
                size: 'lg',
                className: 'w-full border-white bg-white text-zinc-950 shadow-lg shadow-black/20 hover:border-zinc-100 hover:bg-zinc-100 sm:w-auto',
              })}
            >
              Contáctenos
            </Link>
          </div>
        </div>
      </section>

      {/* ── Company intro ────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-yellow-500">
                Nuestra especialidad
              </p>
              <h2 className="mb-5 text-3xl font-bold leading-snug text-zinc-900">
                Especialistas en componentes eléctricos y electrónicos
              </h2>
              <p className="text-sm leading-relaxed text-zinc-500">
                En Centriparts ofrecemos soluciones para el mantenimiento y la reparación de
                los sistemas eléctricos y electrónicos de diferentes vehículos. Le ayudamos a
                identificar la referencia adecuada según sus necesidades y la compatibilidad requerida.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-zinc-100 p-5"
                >
                  <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
                  <p className="mt-1 text-xs text-zinc-400">{stat.label}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── Value propositions ───────────────────────────────────────── */}
      <section className="bg-zinc-50 px-6 py-20">
        <div className="mx-auto max-w-5xl">

          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-500">
              Por qué elegirnos
            </p>
            <h2 className="text-2xl font-bold text-zinc-900">
              Orientación para encontrar el componente adecuado
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {VALUE_PROPS.map((vp) => (
              <div
                key={vp.title}
                className="rounded-xl border border-zinc-100 bg-white p-7"
              >
                <h3 className="mb-2 text-sm font-semibold text-zinc-900">{vp.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-500">{vp.description}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      <LocationSection />

      {/* ── CTA banner ───────────────────────────────────────────────── */}
      <section className="bg-yellow-400 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-black">
            Encuentre la solución eléctrica para su vehículo
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-zinc-700">
            Explore nuestro catálogo o comuníquese con nosotros para recibir orientación
            sobre el componente que necesita.
          </p>
          <Link
            to={ROUTES.PUBLIC_CATALOG}
            className={getButtonClassName({ variant: 'dark', size: 'lg' })}
          >
            Ver catálogo
          </Link>
        </div>
      </section>

    </div>
  )
}
