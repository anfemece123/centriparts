import { BUSINESS_LOCATION } from '@/shared/constants'
import { getButtonClassName } from '@/shared/components/ui'

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.2 7-12a7 7 0 10-14 0c0 6.8 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3.5 2" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.1 3.5l2 4.4-2.2 1.7a15.5 15.5 0 007.5 7.5l1.7-2.2 4.4 2c.2.1.4.4.3.7l-.7 2.8c-.1.4-.5.7-.9.7C10.2 21.1 2.9 13.8 2.9 4.8c0-.4.3-.8.7-.9l2.8-.7c.3-.1.6.1.7.3z" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M8 7h9v9" />
    </svg>
  )
}

export default function LocationSection() {
  return (
    <section className="bg-zinc-950 px-6 py-20 sm:py-24" aria-labelledby="location-title">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-yellow-400">
            Encuéntrenos
          </p>
          <h2 id="location-title" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Visítenos en Pasto
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
            Visite nuestra sede para consultar componentes eléctricos y electrónicos para su
            vehículo. Revise la ruta en Google Maps o comuníquese con nosotros antes de su visita.
          </p>
        </div>

        <div className="grid overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/30 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.5fr)]">
          <div className="relative min-h-[360px] bg-zinc-200 sm:min-h-[440px]">
            <iframe
              src={BUSINESS_LOCATION.googleMapsEmbedUrl}
              title="Ubicación de Centriparts JED en Google Maps"
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-zinc-900 shadow-lg backdrop-blur-sm">
              Pasto · Nariño
            </div>
          </div>

          <div className="flex flex-col justify-between p-7 sm:p-9">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-600">
                Sede Centriparts
              </p>
              <h3 className="mt-3 text-2xl font-bold text-zinc-950">Información para su visita</h3>

              <dl className="mt-8 space-y-6">
                <div className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
                    <PinIcon />
                  </span>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Dirección</dt>
                    <dd className="mt-1 text-sm font-semibold leading-6 text-zinc-900">
                      {BUSINESS_LOCATION.street}<br />
                      {BUSINESS_LOCATION.area}<br />
                      {BUSINESS_LOCATION.city}, {BUSINESS_LOCATION.country}
                    </dd>
                  </div>
                </div>

                <div className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                    <ClockIcon />
                  </span>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Horario</dt>
                    <dd className="mt-1 text-sm leading-6 text-zinc-700">
                      Lunes a viernes · 8:00 a.m. – 6:00 p.m.<br />
                      Sábados · 8:00 a.m. – 1:00 p.m.
                    </dd>
                  </div>
                </div>

                <div className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
                    <PhoneIcon />
                  </span>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Teléfono</dt>
                    <dd className="mt-1">
                      <a href="tel:+573503160713" className="text-sm font-semibold text-zinc-900 transition-colors hover:text-yellow-600">
                        +57 350 316 0713
                      </a>
                    </dd>
                  </div>
                </div>
              </dl>
            </div>

            <div className="mt-9 flex flex-col gap-3">
              <a
                href={BUSINESS_LOCATION.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={getButtonClassName({ size: 'lg', className: 'w-full' })}
              >
                Cómo llegar con Google Maps
                <ArrowIcon />
              </a>
              <a
                href="tel:+573503160713"
                className={getButtonClassName({ variant: 'secondary', size: 'lg', className: 'w-full' })}
              >
                Llamar antes de visitar
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
