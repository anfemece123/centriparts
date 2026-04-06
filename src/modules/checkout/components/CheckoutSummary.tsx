import { useAppSelector } from '@/store'

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export default function CheckoutSummary() {
  const items = useAppSelector((s) => s.cart.items)

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Resumen del pedido
      </h2>

      {/* Item list */}
      <ul className="flex flex-col divide-y divide-zinc-100">
        {items.map((item) => (
          <li key={item.productId} className="flex items-start gap-3 py-3">

            {/* Thumbnail */}
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-100 bg-white">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-xs text-zinc-300">—</span>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-1 flex-col gap-0.5">
              <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-900">
                {item.name}
              </p>
              {item.reference && (
                <p className="text-xs text-zinc-400">Ref: {item.reference}</p>
              )}
              <p className="text-xs text-zinc-400">Cantidad: {item.quantity}</p>
            </div>

            {/* Subtotal */}
            <p className="shrink-0 text-sm font-semibold text-zinc-900">
              {priceFormatter.format(item.price * item.quantity)}
            </p>

          </li>
        ))}
      </ul>

      {/* Totals */}
      <div className="mt-4 flex flex-col gap-2 border-t border-zinc-200 pt-4">
        <div className="flex justify-between text-sm text-zinc-500">
          <span>Subtotal</span>
          <span>{priceFormatter.format(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-zinc-500">
          <span>Envío</span>
          <span className="text-zinc-400">Por coordinar</span>
        </div>
        <div className="flex justify-between text-base font-bold text-zinc-900">
          <span>Total</span>
          <span>{priceFormatter.format(subtotal)}</span>
        </div>
      </div>
    </div>
  )
}
