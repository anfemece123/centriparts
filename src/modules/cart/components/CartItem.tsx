import { useAppDispatch } from '@/store'
import { removeItem, updateQuantity, type CartItem as CartItemType } from '../store/cartSlice'

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

interface Props {
  item: CartItemType
}

export default function CartItem({ item }: Props) {
  const dispatch = useAppDispatch()

  function handleDecrement() {
    dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity - 1 }))
  }

  function handleIncrement() {
    dispatch(updateQuantity({ productId: item.productId, quantity: item.quantity + 1 }))
  }

  function handleRemove() {
    dispatch(removeItem(item.productId))
  }

  return (
    <div className="flex gap-3 py-4">

      {/* Image */}
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50">
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

      {/* Info */}
      <div className="flex min-w-0 flex-1 flex-col gap-1">

        {/* Name + remove */}
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-900">
            {item.name}
          </p>
          <button
            onClick={handleRemove}
            aria-label="Eliminar producto"
            className="shrink-0 text-zinc-300 transition-colors hover:text-red-500"
          >
            {/* × icon */}
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        {/* Reference */}
        {item.reference && (
          <p className="text-xs text-zinc-400">Ref: {item.reference}</p>
        )}

        {/* Quantity + subtotal */}
        <div className="mt-1 flex items-center justify-between">

          {/* Quantity stepper */}
          <div className="flex items-center rounded-lg border border-zinc-200">
            <button
              onClick={handleDecrement}
              aria-label="Reducir cantidad"
              className="flex h-7 w-7 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-40"
              disabled={item.quantity <= 1}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                <path d="M3 8a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5A.75.75 0 013 8z" />
              </svg>
            </button>
            <span className="w-8 text-center text-sm font-medium tabular-nums text-zinc-900">
              {item.quantity}
            </span>
            <button
              onClick={handleIncrement}
              aria-label="Aumentar cantidad"
              className="flex h-7 w-7 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                <path d="M8 3a.75.75 0 01.75.75v3.5h3.5a.75.75 0 010 1.5h-3.5v3.5a.75.75 0 01-1.5 0v-3.5h-3.5a.75.75 0 010-1.5h3.5v-3.5A.75.75 0 018 3z" />
              </svg>
            </button>
          </div>

          {/* Subtotal */}
          <p className="text-sm font-semibold text-zinc-900">
            {priceFormatter.format(item.price * item.quantity)}
          </p>

        </div>
      </div>

    </div>
  )
}
