import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/store'
import { closeCart } from '../store/cartSlice'
import CartItem from './CartItem'

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export default function CartDrawer() {
  const dispatch = useAppDispatch()
  const { items, isOpen } = useAppSelector((s) => s.cart)

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)

  // Close drawer when pressing Escape
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') dispatch(closeCart())
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, dispatch])

  // Prevent body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          aria-hidden="true"
          onClick={() => dispatch(closeCart())}
        />
      )}

      {/* ── Drawer panel ──────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-label="Carrito de compras"
        className={[
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl',
          'transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">Carrito</h2>
            {totalItems > 0 && (
              <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-xs font-semibold text-black">
                {totalItems}
              </span>
            )}
          </div>
          <button
            onClick={() => dispatch(closeCart())}
            aria-label="Cerrar carrito"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z" />
            </svg>
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                className="h-12 w-12 text-zinc-200"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              <p className="text-sm text-zinc-400">Tu carrito está vacío.</p>
              <button
                onClick={() => dispatch(closeCart())}
                className="text-sm font-medium text-yellow-600 hover:text-yellow-700"
              >
                Explorar catálogo
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {items.map((item) => (
                <CartItem key={item.productId} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Footer — only visible when there are items */}
        {items.length > 0 && (
          <div className="border-t border-zinc-100 px-5 py-5">

            {/* Subtotal */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm text-zinc-500">Subtotal</span>
              <span className="text-base font-bold text-zinc-900">
                {priceFormatter.format(subtotal)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Link
                to="/checkout"
                onClick={() => dispatch(closeCart())}
                className="block rounded-lg bg-yellow-400 px-4 py-3 text-center text-sm font-semibold text-black transition-colors hover:bg-yellow-500"
              >
                Proceder al pedido
              </Link>
              <button
                onClick={() => dispatch(closeCart())}
                className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Seguir comprando
              </button>
            </div>

          </div>
        )}

      </div>
    </>
  )
}
