import { Link } from 'react-router-dom'
import { ROUTES } from '@/shared/constants'
import heroBg from '@/assets/hero-centriparts.jpeg'

const VALUE_PROPS = [
  {
    title: 'Amplio catálogo',
    description:
      'Miles de referencias disponibles para las principales marcas del mercado automotriz colombiano.',
  },
  {
    title: 'Compatibilidad verificada',
    description:
      'Cada repuesto incluye información de compatibilidad por marca, modelo y año de fabricación.',
  },
  {
    title: 'Atención especializada',
    description:
      'Asesoría técnica directa para encontrar el repuesto exacto que su vehículo necesita.',
  },
]

const STATS = [
  { label: 'Referencias disponibles', value: '+5.000' },
  { label: 'Marcas cubiertas',        value: '+50'    },
  { label: 'Años de experiencia',     value: '+10'    },
  { label: 'Clientes activos',        value: '+200'   },
]

export default function PublicHomePage() {
  return (
    <div className="flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        className="relative bg-cover bg-center py-24 sm:py-36"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/55" />

        {/* Content sits above the overlay */}
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-yellow-400">
            Distribuidores de repuestos automotrices
          </p>
          <h1 className="mb-6 text-3xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
            El repuesto correcto,<br />en el momento justo
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
            En Centriparts encontrará repuestos de alta calidad para su vehículo, con
            información de compatibilidad verificada y atención personalizada.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <Link
              to={ROUTES.PUBLIC_CATALOG}
              className="w-full rounded-lg bg-yellow-400 px-7 py-3 text-sm font-semibold text-black transition-colors hover:bg-yellow-500 sm:w-auto"
            >
              Explorar catálogo
            </Link>
            <Link
              to={ROUTES.PUBLIC_CONTACT}
              className="w-full rounded-lg border border-white/40 px-7 py-3 text-sm font-semibold text-white transition-colors hover:border-white/70 hover:bg-white/10 sm:w-auto"
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
                Quiénes somos
              </p>
              <h2 className="mb-5 text-3xl font-bold leading-snug text-zinc-900">
                Experiencia y confianza al servicio del sector automotriz
              </h2>
              <p className="text-sm leading-relaxed text-zinc-500">
                Centriparts es una empresa distribuidora de repuestos automotrices con
                trayectoria en el mercado colombiano. Ofrecemos un catálogo actualizado de
                referencias para las principales marcas, con enfoque en calidad,
                disponibilidad y asesoría técnica especializada.
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
              Todo lo que necesita en un solo lugar
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

      {/* ── CTA banner ───────────────────────────────────────────────── */}
      <section className="bg-yellow-400 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-black">
            ¿Necesita un repuesto?
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-zinc-700">
            Explore nuestro catálogo completo con filtros por marca, categoría y
            compatibilidad de vehículo.
          </p>
          <Link
            to={ROUTES.PUBLIC_CATALOG}
            className="inline-block rounded-lg bg-black px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            Ver todos los productos
          </Link>
        </div>
      </section>

    </div>
  )
}
