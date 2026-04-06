import { useSearchParams, Link } from 'react-router-dom'
import { ROUTES } from '@/shared/constants'

const WA_NUMBER = '573503160713'

function buildWaMessage(orderNumber: string) {
  return encodeURIComponent(
    `Hola, acabo de realizar el pedido *${orderNumber}* en Centriparts y quiero confirmar los detalles de pago y entrega. ¿Me pueden ayudar?`,
  )
}

const STEPS = [
  {
    step: '1',
    title: 'Confirmación por correo',
    detail: 'Recibirás un resumen de tu pedido en tu correo electrónico.',
  },
  {
    step: '2',
    title: 'Revisión por un asesor',
    detail: 'Un asesor revisará tu pedido y se pondrá en contacto contigo.',
  },
  {
    step: '3',
    title: 'Acuerdo de pago y envío',
    detail: 'Coordinarás los detalles de pago y fecha de entrega.',
  },
  {
    step: '4',
    title: 'Despacho del pedido',
    detail: 'Tu pedido será preparado y enviado a la dirección indicada.',
  },
]

export default function OrderConfirmationPage() {
  const [params]      = useSearchParams()
  const orderNumber   = params.get('order') ?? ''
  const waLink        = `https://wa.me/${WA_NUMBER}?text=${buildWaMessage(orderNumber)}`
  const trackingLink  = orderNumber
    ? `${ROUTES.PUBLIC_TRACKING}?order=${orderNumber}`
    : ROUTES.PUBLIC_TRACKING

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">

      {/* ── Success header ────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 text-green-600"
            aria-hidden="true"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">¡Pedido recibido!</h1>
        <p className="mt-2 max-w-sm text-sm text-zinc-500">
          Tu pedido ha sido registrado. Un asesor revisará los detalles y se pondrá en contacto
          contigo para confirmar el pago y la entrega.
        </p>
      </div>

      {/* ── Order number ──────────────────────────────────────────────── */}
      {orderNumber && (
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Número de pedido
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tracking-wide text-zinc-900">
            {orderNumber}
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            Guarda este número. Lo necesitarás para hacer seguimiento.
          </p>
        </div>
      )}

      {/* ── Primary CTAs ──────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        {/* WhatsApp — primary action */}
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2.5 rounded-xl bg-[#25D366] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#1ebe5d]"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Confirmar por WhatsApp
        </a>

        {/* Tracking — secondary action */}
        <Link
          to={trackingLink}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 px-6 py-3.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Rastrear mi pedido
        </Link>
      </div>

      {/* ── Next steps ────────────────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-zinc-100 bg-white p-6">
        <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          ¿Qué sigue?
        </p>
        <ol className="flex flex-col gap-4">
          {STEPS.map((s) => (
            <li key={s.step} className="flex items-start gap-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-xs font-bold text-yellow-700">
                {s.step}
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-800">{s.title}</p>
                <p className="text-xs leading-relaxed text-zinc-500">{s.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Footer link ───────────────────────────────────────────────── */}
      <p className="text-center text-sm text-zinc-400">
        ¿Quieres seguir comprando?{' '}
        <Link
          to={ROUTES.PUBLIC_CATALOG}
          className="font-medium text-zinc-700 underline-offset-2 hover:underline"
        >
          Ver catálogo
        </Link>
      </p>

    </div>
  )
}
