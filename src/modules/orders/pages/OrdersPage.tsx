import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, Badge, Input } from '@/shared/components/ui'
import { listOrders } from '@/modules/orders/services/orders.service'
import { ROUTES } from '@/shared/constants'
import type { OrderListItem, OrderStatus, PaymentStatus } from '@/modules/orders/types/orders'

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

// ─────────────────────────────────────────────────────────────────────────────
// Filter options
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: OrderStatus | ''; label: string }[] = [
  { value: '',          label: 'Todos los estados' },
  { value: 'pending',   label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'preparing', label: 'En preparación' },
  { value: 'shipped',   label: 'Enviado' },
  { value: 'delivered', label: 'Entregado' },
  { value: 'cancelled', label: 'Cancelado' },
]

const PAYMENT_OPTIONS: { value: PaymentStatus | ''; label: string }[] = [
  { value: '',          label: 'Todos los pagos' },
  { value: 'pending',   label: 'Pago pendiente' },
  { value: 'confirmed', label: 'Pago confirmado' },
  { value: 'failed',    label: 'Pago fallido' },
  { value: 'refunded',  label: 'Reembolsado' },
]

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
})

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

const PAGE_SIZE = 25

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const navigate = useNavigate()

  const [orders, setOrders]         = useState<OrderListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  const [searchInput, setSearchInput]       = useState('')
  const [search, setSearch]                 = useState('')
  const [statusFilter, setStatusFilter]     = useState<OrderStatus | ''>('')
  const [paymentFilter, setPaymentFilter]   = useState<PaymentStatus | ''>('')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [statusFilter, paymentFilter])

  // Fetch
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    listOrders({
      search:        search || undefined,
      status:        statusFilter || undefined,
      paymentStatus: paymentFilter || undefined,
      page,
      pageSize:      PAGE_SIZE,
    })
      .then(({ data, count }) => {
        if (cancelled) return
        setOrders(data)
        setTotalCount(count)
      })
      .catch(() => {
        if (cancelled) return
        setError('No se pudieron cargar los pedidos. Intente de nuevo.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [search, statusFilter, paymentFilter, page])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const pageStart  = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd    = Math.min(page * PAGE_SIZE, totalCount)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pedidos"
        description={`${totalCount.toLocaleString('es-CO')} pedido${totalCount !== 1 ? 's' : ''} en total`}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <Input
            placeholder="Buscar por número de pedido o correo…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | '')}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
        >
          {PAYMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card padding={false}>
        {error ? (
          <p className="px-6 py-10 text-center text-sm text-red-500">{error}</p>
        ) : loading ? (
          <p className="px-6 py-10 text-center text-sm text-zinc-400">Cargando pedidos…</p>
        ) : orders.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-zinc-400">
            No se encontraron pedidos con los filtros aplicados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Número</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(ROUTES.ADMIN_ORDERS + '/' + order.id)}
                    className="cursor-pointer hover:bg-zinc-50"
                  >
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-zinc-900">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900">{order.customer_name}</p>
                      <p className="text-xs text-zinc-400">{order.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-zinc-900">
                      {priceFormatter.format(order.total)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={ORDER_STATUS_LABELS[order.status]}
                        variant={ORDER_STATUS_BADGE[order.status]}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={PAYMENT_STATUS_LABELS[order.payment_status]}
                        variant={PAYMENT_STATUS_BADGE[order.payment_status]}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                      {formatDate(order.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {!loading && totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>
            Mostrando {pageStart}–{pageEnd} de {totalCount.toLocaleString('es-CO')} pedidos
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="px-2 tabular-nums">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
