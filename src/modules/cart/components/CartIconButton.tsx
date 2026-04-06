import { useAppDispatch, useAppSelector } from '@/store'
import { openCart } from '../store/cartSlice'

export default function CartIconButton() {
  const dispatch = useAppDispatch()
  const totalItems = useAppSelector((s) =>
    s.cart.items.reduce((sum, item) => sum + item.quantity, 0),
  )

  return (
    <button
      onClick={() => dispatch(openCart())}
      aria-label={`Abrir carrito${totalItems > 0 ? `, ${totalItems} productos` : ''}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100"
    >
      {/* Shopping cart icon */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>

      {/* Item count badge */}
      {totalItems > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-400 px-1 text-[10px] font-bold leading-none text-black">
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </button>
  )
}
