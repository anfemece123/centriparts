import { Link } from 'react-router-dom'
import { ROUTES } from '@/shared/constants'

const VALUES = [
  {
    title: 'Calidad garantizada',
    description:
      'Trabajamos únicamente con proveedores verificados y productos que cumplen estándares técnicos exigentes.',
  },
  {
    title: 'Amplio inventario',
    description:
      'Miles de referencias disponibles para las principales marcas del mercado automotriz colombiano.',
  },
  {
    title: 'Compatibilidad verificada',
    description:
      'Cada repuesto incluye información de compatibilidad por marca, modelo y año de fabricación.',
  },
  {
    title: 'Atención personalizada',
    description:
      'Asesoría técnica directa para encontrar el repuesto exacto que su vehículo necesita.',
  },
  {
    title: 'Entrega oportuna',
    description:
      'Comprometidos con los tiempos de respuesta para que su taller no se detenga.',
  },
  {
    title: 'Respaldo comercial',
    description:
      'Años de experiencia en el sector nos respaldan como un aliado confiable para talleres y distribuidores.',
  },
]

const OFFERINGS = [
  {
    title: 'Repuestos eléctricos',
    description: 'Sensores, actuadores, módulos de control y componentes del sistema eléctrico automotriz.',
  },
  {
    title: 'Componentes mecánicos',
    description: 'Bombas de agua, filtros, correas, rodamientos y partes de motor para múltiples marcas.',
  },
  {
    title: 'Distribución mayorista',
    description: 'Atendemos talleres, concesionarios y distribuidores con precios y condiciones comerciales especiales.',
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
            Distribuidores de repuestos automotrices con experiencia, calidad y compromiso al servicio del sector.
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
                Experiencia y confianza al servicio del sector automotriz
              </h2>
              <p className="mb-4 text-sm leading-relaxed text-zinc-500">
                Centriparts es una empresa distribuidora de repuestos automotrices con trayectoria
                en el mercado colombiano. Nacimos con el propósito de conectar a talleres mecánicos,
                concesionarios y distribuidores con los repuestos que necesitan, en el tiempo que
                los necesitan.
              </p>
              <p className="text-sm leading-relaxed text-zinc-500">
                Ofrecemos un catálogo amplio y actualizado de referencias eléctricas y mecánicas
                para las principales marcas del mercado, con un enfoque claro en calidad,
                disponibilidad y asesoría técnica especializada.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { value: '+5.000', label: 'Referencias disponibles' },
                { value: '+50',   label: 'Marcas cubiertas'        },
                { value: '+10',   label: 'Años de experiencia'     },
                { value: '+200',  label: 'Clientes activos'        },
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
              Soluciones para el sector automotriz
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-500">
              Cubrimos las principales categorías de repuestos para que su negocio tenga
              todo en un mismo proveedor confiable.
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
            "Ser el aliado estratégico del sector automotriz colombiano, ofreciendo repuestos
            de calidad con información técnica verificada y atención que genera confianza."
          </p>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="bg-yellow-400 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-black">
            ¿Listo para encontrar lo que necesita?
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-zinc-700">
            Explore nuestro catálogo completo o comuníquese directamente con nuestro equipo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to={ROUTES.PUBLIC_CATALOG}
              className="rounded-lg bg-black px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Ver catálogo
            </Link>
            <Link
              to={ROUTES.PUBLIC_CONTACT}
              className="rounded-lg border border-black/30 bg-yellow-400 px-7 py-3 text-sm font-semibold text-black transition-colors hover:bg-yellow-500"
            >
              Contáctenos
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
