import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader, Card, Badge, Button } from '@/shared/components/ui'
import {
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
  addAdminNote,
} from '@/modules/orders/services/orders.service'
import { ROUTES } from '@/shared/constants'
import type {
  OrderWithItems,
  OrderStatus,
  PaymentStatus,
  OrderStatusHistory,
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

const ORDER_STATUS_BADGE: Record<OrderStatus, 'default' | 'info' | 'success' | 'danger' | 'warning'> = {
  pending:   'warning',
  confirmed: 'info',
  preparing: 'info',
  shipped:   'info',
  delivered: 'success',
  cancelled: 'danger',
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending:   'Pendiente',
  confirmed: 'Confirmado',
  failed:    'Fallido',
  refunded:  'Reembolsado',
}

const PAYMENT_STATUS_BADGE: Record<PaymentStatus, 'default' | 'success' | 'danger' | 'warning'> = {
  pending:   'warning',
  confirmed: 'success',
  failed:    'danger',
  refunded:  'default',
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

const ALL_ORDER_STATUSES: OrderStatus[] = [
  'pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled',
]

const ALL_PAYMENT_STATUSES: PaymentStatus[] = [
  'pending', 'confirmed', 'failed', 'refunded',
]

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function buildWaLink(phone: string, orderNumber: string, customerName: string) {
  const digits  = phone.replace(/\D/g, '')
  const waPhone = digits.startsWith('57') ? digits : `57${digits}`
  const firstName = customerName.split(' ')[0]
  const message = encodeURIComponent(
    `Hola ${firstName}, te contactamos de *Centriparts* en relación a tu pedido *${orderNumber}*. Queremos confirmar los detalles de pago y envío. ¿Tienes un momento?`,
  )
  return `https://wa.me/${waPhone}?text=${message}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ReadOnlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function StatusSelector({
  label,
  options,
  currentValue,
  renderBadge,
  onSave,
}: {
  label:        string
  options:      string[]
  currentValue: string
  renderBadge:  (value: string) => React.ReactNode
  onSave:       (newValue: string, comment: string) => Promise<void>
}) {
  const [selected, setSelected] = useState(currentValue)
  const [comment, setComment]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)

  // Sync when parent reloads order
  useEffect(() => { setSelected(currentValue) }, [currentValue])

  const dirty = selected !== currentValue

  async function handleSave() {
    if (!dirty) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      await onSave(selected, comment)
      setComment('')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('No se pudo guardar el cambio. Intente de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
        {renderBadge(currentValue)}
      </div>

      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={saving}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{label === 'Estado del pedido'
            ? ORDER_STATUS_LABELS[opt as OrderStatus]
            : PAYMENT_STATUS_LABELS[opt as PaymentStatus]
          }</option>
        ))}
      </select>

      {dirty && (
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={saving}
          placeholder="Comentario opcional para el historial…"
          className="resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:opacity-60"
        />
      )}

      <div className="flex items-center gap-3">
        <Button size="sm" disabled={!dirty || saving} onClick={handleSave}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
        {success && <span className="text-sm text-green-600">Guardado correctamente.</span>}
        {error   && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </div>
  )
}

function HistoryTimeline({ history }: { history: OrderStatusHistory[] }) {
  const sorted = [...history].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )

  if (sorted.length === 0) {
    return <p className="text-sm text-zinc-400 italic">Sin historial.</p>
  }

  return (
    <ol className="flex flex-col gap-0">
      {sorted.map((entry, i) => {
        const isLast = i === sorted.length - 1
        return (
          <li key={entry.id} className="flex gap-3">
            {/* Timeline rail */}
            <div className="flex flex-col items-center">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-yellow-400 ring-2 ring-yellow-100" />
              {!isLast && <span className="mt-1 w-px flex-1 bg-zinc-200" />}
            </div>

            {/* Content */}
            <div className={['pb-5', isLast ? '' : ''].join(' ')}>
              <p className="text-xs text-zinc-400">{formatDate(entry.created_at)}</p>
              <p className="mt-0.5 text-sm font-medium text-zinc-700">
                {HISTORY_FIELD_LABELS[entry.field] ?? entry.field}
              </p>
              <p className="text-sm text-zinc-500">
                {entry.previous_value === null
                  ? <>Establecido en <span className="font-medium text-zinc-800">{entry.new_value}</span></>
                  : <><span className="font-medium text-zinc-500">{entry.previous_value}</span>{' → '}<span className="font-medium text-zinc-800">{entry.new_value}</span></>
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
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [order, setOrder]       = useState<OrderWithItems | null>(null)
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Admin notes local state
  const [notesValue, setNotesValue]   = useState('')
  const [notesDirty, setNotesDirty]   = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesError, setNotesError]   = useState<string | null>(null)
  const [notesSuccess, setNotesSuccess] = useState(false)

  async function loadOrder() {
    if (!id) return
    setLoadError(null)
    try {
      const data = await getOrder(id)
      if (!data) { setLoadError('Pedido no encontrado.'); return }
      setOrder(data)
      setNotesValue(data.admin_notes ?? '')
      setNotesDirty(false)
    } catch {
      setLoadError('No se pudo cargar el pedido.')
    }
  }

  useEffect(() => {
    setLoading(true)
    loadOrder().finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleStatusSave(newStatus: string, comment: string) {
    if (!order) return
    await updateOrderStatus(
      order.id,
      order.status,
      newStatus as OrderStatus,
      comment,
      { email: order.customer_email, name: order.customer_name, orderNumber: order.order_number },
    )
    await loadOrder()
  }

  async function handlePaymentStatusSave(newStatus: string, comment: string) {
    if (!order) return
    await updatePaymentStatus(order.id, order.payment_status, newStatus as PaymentStatus, comment)
    await loadOrder()
  }

  async function handleNotesSave() {
    if (!order || !notesDirty) return
    setNotesSaving(true)
    setNotesError(null)
    setNotesSuccess(false)
    try {
      await addAdminNote(order.id, notesValue)
      setNotesDirty(false)
      setNotesSuccess(true)
      setTimeout(() => setNotesSuccess(false), 3000)
    } catch {
      setNotesError('No se pudo guardar la nota.')
    } finally {
      setNotesSaving(false)
    }
  }

  // ── Loading / error states ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-zinc-400">Cargando pedido…</p>
      </div>
    )
  }

  if (loadError || !order) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p className="text-sm text-red-500">{loadError ?? 'Pedido no encontrado.'}</p>
        <Button variant="secondary" size="sm" onClick={() => navigate(ROUTES.ADMIN_ORDERS)}>
          Volver a pedidos
        </Button>
      </div>
    )
  }

  // ── Financial totals ────────────────────────────────────────────────────

  const itemsTotal = order.items.reduce((s, i) => s + i.subtotal, 0)

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <PageHeader
        title={`Pedido ${order.order_number}`}
        description={`Realizado el ${formatDate(order.created_at)}`}
        actions={
          <div className="flex items-center gap-3">
            {order.customer_phone && (
              <a
                href={buildWaLink(order.customer_phone, order.order_number, order.customer_name)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-600"
              >
                {/* WhatsApp icon */}
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Contactar por WhatsApp
              </a>
            )}
            <Button variant="secondary" size="sm" onClick={() => navigate(ROUTES.ADMIN_ORDERS)}>
              ← Volver a pedidos
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── Left column (2/3) ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-6 lg:col-span-2">

          {/* Customer info */}
          <Card>
            <h2 className="mb-5 text-sm font-semibold text-zinc-700">Información del cliente</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Nombre">
                <span className="text-sm text-zinc-800">{order.customer_name}</span>
              </ReadOnlyField>
              <ReadOnlyField label="Correo electrónico">
                <span className="text-sm text-zinc-800">{order.customer_email}</span>
              </ReadOnlyField>
              {order.customer_phone && (
                <ReadOnlyField label="Teléfono">
                  <span className="text-sm text-zinc-800">{order.customer_phone}</span>
                </ReadOnlyField>
              )}
              {order.payment_method && (
                <ReadOnlyField label="Método de pago">
                  <span className="text-sm text-zinc-800">
                    {PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method}
                  </span>
                </ReadOnlyField>
              )}
            </dl>
          </Card>

          {/* Shipping info */}
          <Card>
            <h2 className="mb-5 text-sm font-semibold text-zinc-700">Dirección de envío</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Dirección">
                <span className="text-sm text-zinc-800">{order.shipping_address}</span>
              </ReadOnlyField>
              <ReadOnlyField label="Ciudad">
                <span className="text-sm text-zinc-800">{order.shipping_city}</span>
              </ReadOnlyField>
              <ReadOnlyField label="Departamento">
                <span className="text-sm text-zinc-800">{order.shipping_department}</span>
              </ReadOnlyField>
              <ReadOnlyField label="País">
                <span className="text-sm text-zinc-800">{order.shipping_country}</span>
              </ReadOnlyField>
            </dl>
          </Card>

          {/* Ordered items */}
          <Card padding={false}>
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-700">
                Artículos del pedido
                <span className="ml-2 text-xs font-normal text-zinc-400">
                  ({order.items.length} {order.items.length === 1 ? 'producto' : 'productos'})
                </span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3 text-center">Cant.</th>
                    <th className="px-4 py-3 text-right">Precio unit.</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{item.product_name}</p>
                        {item.product_reference && (
                          <p className="text-xs text-zinc-400">Ref: {item.product_reference}</p>
                        )}
                        {item.product_ci && (
                          <p className="font-mono text-xs text-zinc-400">CI: {item.product_ci}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-zinc-700">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                        {priceFormatter.format(item.unit_price)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-900">
                        {priceFormatter.format(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Customer notes */}
          {order.customer_notes && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-zinc-700">Notas del cliente</h2>
              <p className="text-sm text-zinc-600 whitespace-pre-wrap">{order.customer_notes}</p>
            </Card>
          )}

          {/* Admin notes */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-zinc-700">Notas del asesor</h2>
            <textarea
              rows={4}
              value={notesValue}
              onChange={(e) => {
                setNotesValue(e.target.value)
                setNotesDirty(e.target.value !== (order.admin_notes ?? ''))
              }}
              disabled={notesSaving}
              placeholder="Observaciones internas, acuerdos con el cliente, etc."
              className="w-full resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:opacity-60"
            />
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" disabled={!notesDirty || notesSaving} onClick={handleNotesSave}>
                {notesSaving ? 'Guardando…' : 'Guardar notas'}
              </Button>
              {notesSuccess && <span className="text-sm text-green-600">Notas guardadas.</span>}
              {notesError   && <span className="text-sm text-red-500">{notesError}</span>}
            </div>
          </Card>

        </div>

        {/* ── Right column (1/3) ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">

          {/* Financial summary */}
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-zinc-700">Resumen financiero</h2>
            <dl className="flex flex-col gap-3">
              <div className="flex justify-between text-sm text-zinc-500">
                <span>Subtotal de artículos</span>
                <span className="tabular-nums">{priceFormatter.format(itemsTotal)}</span>
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
          </Card>

          {/* Order status */}
          <Card>
            <StatusSelector
              label="Estado del pedido"
              options={ALL_ORDER_STATUSES}
              currentValue={order.status}
              renderBadge={(v) => (
                <Badge
                  label={ORDER_STATUS_LABELS[v as OrderStatus]}
                  variant={ORDER_STATUS_BADGE[v as OrderStatus]}
                />
              )}
              onSave={handleStatusSave}
            />
          </Card>

          {/* Payment status */}
          <Card>
            <StatusSelector
              label="Estado del pago"
              options={ALL_PAYMENT_STATUSES}
              currentValue={order.payment_status}
              renderBadge={(v) => (
                <Badge
                  label={PAYMENT_STATUS_LABELS[v as PaymentStatus]}
                  variant={PAYMENT_STATUS_BADGE[v as PaymentStatus]}
                />
              )}
              onSave={handlePaymentStatusSave}
            />
          </Card>

          {/* History timeline */}
          <Card>
            <h2 className="mb-5 text-sm font-semibold text-zinc-700">Historial de cambios</h2>
            <HistoryTimeline history={order.history} />
          </Card>

        </div>

      </div>
    </div>
  )
}
