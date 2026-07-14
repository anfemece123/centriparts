import { Link } from 'react-router-dom'
import { ROUTES } from '@/shared/constants'
import { getButtonClassName } from '@/shared/components/ui'

const VALUES = [
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
    title: 'Referencias confiables',
    description:
      'Encuentre alternativas para el mantenimiento y la reparación de los sistemas eléctricos de su vehículo.',
  },
  {
    title: 'Atención personalizada',
    description:
      'Consulte sus dudas y reciba acompañamiento durante la búsqueda de la referencia que necesita.',
  },
  {
    title: 'Respuesta oportuna',
    description:
      'Atendemos sus consultas de disponibilidad y compatibilidad con información clara y directa.',
  },
  {
    title: 'Orientación comercial',
    description:
      'Acompañamos a propietarios, técnicos, talleres y electricistas automotrices en su búsqueda.',
  },
]

const OFFERINGS = [
  {
    title: 'Sistemas eléctricos',
    description: 'Componentes para sistemas de encendido, carga, iluminación y protección eléctrica automotriz.',
  },
  {
    title: 'Sensores y electrónica',
    description: 'Sensores, actuadores, módulos y componentes electrónicos para diagnóstico, mantenimiento y reparación.',
  },
  {
    title: 'Conexión y control',
    description: 'Fusibles, relés, interruptores, conectores y soluciones para circuitos eléctricos del vehículo.',
  },
]

export default function NosotrosPage() {
  return (
    <div className="flex flex-col">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <section className="border-b border-zinc-100 bg-zinc-900 px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-yellow-400">
            Quiénes somos
          </p>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            Nosotros
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-400">
            Especialistas en componentes eléctricos y electrónicos para vehículos, con atención clara y personalizada.
          </p>
        </div>
      </section>

      {/* ── Company description ──────────────────────────────────────── */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-yellow-500">
                Nuestra empresa
              </p>
              <h2 className="mb-5 text-3xl font-bold leading-snug text-zinc-900">
                Experiencia en electricidad automotriz
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-zinc-500">
                Centriparts está orientado a la comercialización de componentes eléctricos y
                electrónicos para vehículos. Nuestro objetivo es facilitar la búsqueda de referencias
                y brindar una atención clara y personalizada a clientes, técnicos y talleres.
              </p>
              <p className="text-sm leading-relaxed text-zinc-500">
                Trabajamos para que cada cliente pueda encontrar soluciones para sistemas de
                encendido, carga, iluminación, sensores, conexiones y otros componentes eléctricos
                del vehículo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { value: 'Energía',    label: 'Sistemas eléctricos' },
                { value: 'Control',    label: 'Componentes electrónicos' },
                { value: 'Multimarca', label: 'Aplicaciones' },
                { value: 'Asesoría',   label: 'Atención personalizada' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-zinc-100 p-6">
                  <p className="text-3xl font-bold text-zinc-900">{stat.value}</p>
                  <p className="mt-1 text-xs text-zinc-400">{stat.label}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── What we offer ────────────────────────────────────────────── */}
      <section className="bg-zinc-50 px-6 py-20">
        <div className="mx-auto max-w-5xl">

          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-500">
              Qué ofrecemos
            </p>
            <h2 className="text-2xl font-bold text-zinc-900">
              Soluciones para sistemas eléctricos y electrónicos
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-500">
              Orientación y componentes para sistemas de encendido, carga, iluminación,
              sensores, conexiones y control automotriz.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {OFFERINGS.map((item) => (
              <div key={item.title} className="rounded-xl border border-zinc-100 bg-white p-7">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100">
                  <span className="text-lg text-yellow-600">⚙</span>
                </div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-900">{item.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-500">{item.description}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Why choose us ────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">

          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-500">
              Por qué elegirnos
            </p>
            <h2 className="text-2xl font-bold text-zinc-900">
              Nuestro compromiso con el cliente
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((val) => (
              <div
                key={val.title}
                className="flex flex-col gap-2 rounded-xl border border-zinc-100 p-6"
              >
                <div className="h-1 w-8 rounded-full bg-yellow-400" />
                <h3 className="text-sm font-semibold text-zinc-900">{val.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-500">{val.description}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Mission strip ────────────────────────────────────────────── */}
      <section className="border-y border-zinc-100 bg-zinc-50 px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-500">
            Nuestra misión
          </p>
          <p className="text-xl font-semibold leading-relaxed text-zinc-800 sm:text-2xl">
            "Facilitar la búsqueda de componentes eléctricos y electrónicos para vehículos,
            con información de compatibilidad y una atención clara, cercana y especializada."
          </p>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="bg-yellow-400 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-black">
            ¿No sabe cuál referencia necesita?
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-zinc-700">
            Comuníquese con nuestro equipo y reciba orientación para identificar el componente
            compatible con su vehículo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to={ROUTES.PUBLIC_CATALOG}
              className={getButtonClassName({ variant: 'dark', size: 'lg' })}
            >
              Ver catálogo
            </Link>
            <Link
              to={ROUTES.PUBLIC_CONTACT}
              className={getButtonClassName({ size: 'lg', className: 'border-black/20' })}
            >
              Solicitar asesoría
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
