import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getOrderForTracking } from '@/modules/orders/services/tracking.service'
import type {
  PublicOrderView,
  PublicOrderHistoryEntry,
  OrderStatus,
  PaymentStatus,
} from '@/modules/orders/types/orders'

// ─────────────────────────────────────────────────────────────────────────────
// Label / variant maps
// ─────────────────────────────────────────────────────────────────────────────

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending:   'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  shipped:   'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending:   'Pago pendiente',
  confirmed: 'Pago confirmado',
  failed:    'Pago fallido',
  refunded:  'Reembolsado',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  transfer:  'Transferencia bancaria',
  nequi:     'Nequi',
  daviplata: 'Daviplata',
  cash:      'Contra entrega',
  other:     'Otro',
}

const HISTORY_FIELD_LABELS: Record<string, string> = {
  status:         'Estado del pedido',
  payment_status: 'Estado del pago',
}

type StatusColor = 'yellow' | 'blue' | 'green' | 'red' | 'zinc'

const ORDER_STATUS_COLOR: Record<OrderStatus, StatusColor> = {
  pending:   'yellow',
  confirmed: 'blue',
  preparing: 'blue',
  shipped:   'blue',
  delivered: 'green',
  cancelled: 'red',
}

const PAYMENT_STATUS_COLOR: Record<PaymentStatus, StatusColor> = {
  pending:   'yellow',
  confirmed: 'green',
  failed:    'red',
  refunded:  'zinc',
}

const STATUS_BADGE_CLASSES: Record<StatusColor, string> = {
  yellow: 'bg-yellow-100 text-yellow-800',
  blue:   'bg-blue-100 text-blue-700',
  green:  'bg-green-100 text-green-700',
  red:    'bg-red-100 text-red-700',
  zinc:   'bg-zinc-100 text-zinc-600',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function StatusBadge({ label, color }: { label: string; color: StatusColor }) {
  return (
    <span className={[
      'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
      STATUS_BADGE_CLASSES[color],
    ].join(' ')}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// History timeline
// ─────────────────────────────────────────────────────────────────────────────

function HistoryTimeline({ history }: { history: PublicOrderHistoryEntry[] }) {
  const sorted = [...history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  return (
    <ol className="flex flex-col">
      {sorted.map((entry, i) => {
        const isLast = i === sorted.length - 1
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-400 ring-2 ring-yellow-100" />
              {!isLast && <span className="mt-1 w-px flex-1 bg-zinc-200" />}
            </div>
            <div className="pb-5">
              <p className="text-xs text-zinc-400">{formatDate(entry.created_at)}</p>
              <p className="mt-0.5 text-sm font-medium text-zinc-700">
                {HISTORY_FIELD_LABELS[entry.field] ?? entry.field}
              </p>
              <p className="text-sm text-zinc-500">
                {entry.previous_value === null
                  ? <>Establecido en <span className="font-medium text-zinc-800">{entry.new_value}</span></>
                  : <><span className="text-zinc-400">{entry.previous_value}</span>{' → '}<span className="font-medium text-zinc-800">{entry.new_value}</span></>
                }
              </p>
              {entry.comment && (
                <p className="mt-1 text-xs text-zinc-400 italic">"{entry.comment}"</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Result view
// ─────────────────────────────────────────────────────────────────────────────

function OrderResult({ order }: { order: PublicOrderView }) {
  return (
    <div className="flex flex-col gap-5">

      {/* Status banner */}
      <div className="rounded-2xl border border-zinc-100 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Número de pedido</p>
            <p className="mt-1 font-mono text-2xl font-bold text-zinc-900">{order.order_number}</p>
            <p className="mt-1 text-xs text-zinc-400">Realizado el {formatDate(order.created_at)}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge
              label={ORDER_STATUS_LABELS[order.status]}
              color={ORDER_STATUS_COLOR[order.status]}
            />
            <StatusBadge
              label={PAYMENT_STATUS_LABELS[order.payment_status]}
              color={PAYMENT_STATUS_COLOR[order.payment_status]}
            />
          </div>
        </div>

        {/* Shipping destination */}
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <p className="text-xs text-zinc-400">Destino de envío</p>
          <p className="mt-0.5 text-sm text-zinc-700">
            {order.shipping_city}, {order.shipping_department}
          </p>
          {order.payment_method && (
            <>
              <p className="mt-3 text-xs text-zinc-400">Método de pago</p>
              <p className="mt-0.5 text-sm text-zinc-700">
                {PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white">
        <div className="border-b border-zinc-100 px-6 py-4">
          <p className="text-sm font-semibold text-zinc-700">
            Artículos del pedido
            <span className="ml-2 font-normal text-zinc-400">
              ({order.items.length} {order.items.length === 1 ? 'producto' : 'productos'})
            </span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-3">Producto</th>
                <th className="px-5 py-3 text-center">Cant.</th>
                <th className="px-5 py-3 text-right">Precio unit.</th>
                <th className="px-5 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {order.items.map((item, i) => (
                <tr key={i}>
                  <td className="px-5 py-3">
                    <p className="font-medium text-zinc-900">{item.product_name}</p>
                    {item.product_reference && (
                      <p className="text-xs text-zinc-400">Ref: {item.product_reference}</p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center tabular-nums text-zinc-700">
                    {item.quantity}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-zinc-500">
                    {priceFormatter.format(item.unit_price)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-zinc-900">
                    {priceFormatter.format(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals + history in a responsive grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

        {/* Financial summary */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-6">
          <p className="mb-4 text-sm font-semibold text-zinc-700">Resumen financiero</p>
          <dl className="flex flex-col gap-3">
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Subtotal</span>
              <span className="tabular-nums">{priceFormatter.format(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-zinc-500">
              <span>Envío</span>
              <span className="tabular-nums">
                {order.shipping_cost > 0
                  ? priceFormatter.format(order.shipping_cost)
                  : 'Por coordinar'}
              </span>
            </div>
            <div className="flex justify-between border-t border-zinc-100 pt-3 text-base font-bold text-zinc-900">
              <span>Total</span>
              <span className="tabular-nums">{priceFormatter.format(order.total)}</span>
            </div>
          </dl>

          {order.customer_notes && (
            <div className="mt-5 border-t border-zinc-100 pt-4">
              <p className="text-xs font-medium text-zinc-400">Notas del pedido</p>
              <p className="mt-1 text-sm text-zinc-600 whitespace-pre-wrap">{order.customer_notes}</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-6">
          <p className="mb-5 text-sm font-semibold text-zinc-700">Historial del pedido</p>
          <HistoryTimeline history={order.history} />
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function TrackingPage() {
  const [params] = useSearchParams()

  const [orderNumber, setOrderNumber] = useState(params.get('order') ?? '')
  const [email, setEmail]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [result, setResult]           = useState<PublicOrderView | null | undefined>(undefined)
  // undefined = not searched yet, null = searched but not found

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orderNumber.trim() || !email.trim()) return

    setLoading(true)
    setResult(undefined)

    try {
      const data = await getOrderForTracking(orderNumber, email)
      setResult(data)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">

      {/* Page title */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">Rastrear pedido</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Ingresa el número de pedido y tu correo para consultar el estado.
        </p>
      </div>

      {/* Search form */}
      <form
        onSubmit={handleSubmit}
        className="mx-auto mb-10 max-w-md rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="order_number" className="text-sm font-medium text-zinc-700">
              Número de pedido
            </label>
            <input
              id="order_number"
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Ej: CP-000042"
              autoComplete="off"
              autoCapitalize="characters"
              disabled={loading}
              className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="tracking_email" className="text-sm font-medium text-zinc-700">
              Correo electrónico
            </label>
            <input
              id="tracking_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="El correo que usaste al comprar"
              autoComplete="email"
              disabled={loading}
              className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !orderNumber.trim() || !email.trim()}
            className="w-full rounded-xl bg-yellow-400 py-3 text-sm font-bold text-black transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Buscando…' : 'Buscar pedido'}
          </button>
        </div>
      </form>

      {/* Not found */}
      {result === null && (
        <div className="mx-auto max-w-md rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
          <p className="text-sm font-semibold text-red-700">No encontramos tu pedido</p>
          <p className="mt-1 text-xs text-red-500">
            Verifica que el número de pedido y el correo sean exactamente los que usaste al comprar.
          </p>
        </div>
      )}

      {/* Result */}
      {result && <OrderResult order={result} />}

    </div>
  )
}
