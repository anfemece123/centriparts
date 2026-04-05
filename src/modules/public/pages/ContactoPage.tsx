const CONTACT_CARDS = [
  {
    label: 'Teléfono',
    value: '+57 350 316 0713',
    detail: 'Llámenos directamente',
    href: 'tel:+573503160713',
    icon: '📞',
  },
  {
    label: 'WhatsApp',
    value: '+57 350 316 0713',
    detail: 'Escríbanos por WhatsApp',
    href: 'https://wa.me/573503160713?text=Hola%2C%20estoy%20interesado%20en%20sus%20productos',
    icon: '💬',
    external: true,
  },
  {
    label: 'Correo electrónico',
    value: 'info@centriparts.com',
    detail: 'Respuesta en menos de 24 horas',
    href: 'mailto:info@centriparts.com',
    icon: '✉',
  },
  {
    label: 'Dirección',
    value: 'Bogotá, Colombia',
    detail: 'Contáctenos para coordinar visitas',
    href: undefined,
    icon: '📍',
  },
]

const SCHEDULE_ROWS = [
  { day: 'Lunes – Viernes', hours: '8:00 a.m. – 6:00 p.m.' },
  { day: 'Sábado',          hours: '8:00 a.m. – 1:00 p.m.' },
  { day: 'Domingo',         hours: 'Cerrado'                },
]

export default function ContactoPage() {
  return (
    <div className="flex flex-col">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <section className="border-b border-zinc-100 bg-zinc-900 px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-yellow-400">
            Estamos aquí para ayudarle
          </p>
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            Contacto
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-400">
            Comuníquese con nuestro equipo a través del canal que prefiera. Respondemos con rapidez.
          </p>
        </div>
      </section>

      {/* ── Contact cards ────────────────────────────────────────────── */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-5xl">

          <div className="mb-12 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-500">
              Canales de atención
            </p>
            <h2 className="text-2xl font-bold text-zinc-900">
              Información de contacto
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CONTACT_CARDS.map((card) => {
              const inner = (
                <div className="flex h-full flex-col gap-3 rounded-xl border border-zinc-100 p-7 transition-shadow hover:shadow-md">
                  <span className="text-2xl">{card.icon}</span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      {card.label}
                    </p>
                    <p className="mt-1 text-base font-semibold text-zinc-900">{card.value}</p>
                    <p className="mt-1 text-xs text-zinc-400">{card.detail}</p>
                  </div>
                </div>
              )

              if (card.href) {
                return (
                  <a
                    key={card.label}
                    href={card.href}
                    target={card.external ? '_blank' : undefined}
                    rel={card.external ? 'noopener noreferrer' : undefined}
                    className="block"
                  >
                    {inner}
                  </a>
                )
              }

              return <div key={card.label}>{inner}</div>
            })}
          </div>

        </div>
      </section>

      {/* ── Schedule ─────────────────────────────────────────────────── */}
      <section className="bg-zinc-50 px-6 py-20">
        <div className="mx-auto max-w-3xl">

          <div className="mb-10 text-center">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-500">
              Horarios
            </p>
            <h2 className="text-2xl font-bold text-zinc-900">Horario de atención</h2>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-100 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="px-6 py-4 text-left font-semibold text-zinc-500">Día</th>
                  <th className="px-6 py-4 text-right font-semibold text-zinc-500">Horario</th>
                </tr>
              </thead>
              <tbody>
                {SCHEDULE_ROWS.map((row, i) => (
                  <tr
                    key={row.day}
                    className={i < SCHEDULE_ROWS.length - 1 ? 'border-b border-zinc-100' : ''}
                  >
                    <td className="px-6 py-4 text-zinc-700">{row.day}</td>
                    <td className="px-6 py-4 text-right font-medium text-zinc-900">
                      {row.hours}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-center text-xs text-zinc-400">
            Horario en zona horaria de Colombia (UTC-5).
          </p>

        </div>
      </section>

      {/* ── WhatsApp highlight ───────────────────────────────────────── */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-zinc-100 bg-zinc-50 p-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-8 w-8 text-green-600"
                aria-hidden="true"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900">
                Contáctenos por WhatsApp
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                La forma más rápida de resolver sus dudas, consultar disponibilidad
                o solicitar una cotización personalizada.
              </p>
            </div>
            <a
              href="https://wa.me/573503160713?text=Hola%2C%20estoy%20interesado%20en%20sus%20productos"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-600"
            >
              Escribir por WhatsApp
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
