import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPublicImageUrl } from '@/modules/catalog/services/product-images.service'
import { addItem, openCart } from '@/modules/cart/store/cartSlice'
import Button from '@/shared/components/ui/Button'
import { useAppDispatch } from '@/store'
import type { PublicProductListItem } from '@/types'

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

function resolveCardImage(
  images: PublicProductListItem['images'],
): PublicProductListItem['images'][number] | null {
  if (images.length === 0) return null

  return [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return a.display_order - b.display_order
  })[0]
}

function ShoppingBagIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8h12l1 12H5L6 8Z" />
      <path d="M9 10V6a3 3 0 0 1 6 0v4" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}

interface PublicProductCardProps {
  product: PublicProductListItem
}

export default function PublicProductCard({ product }: PublicProductCardProps) {
  const dispatch = useAppDispatch()
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isAdded, setIsAdded] = useState(false)

  const image = resolveCardImage(product.images)
  const name = product.display_name ?? product.base_name
  const imageUrl = image ? getPublicImageUrl(image.storage_path) : null

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    }
  }, [])

  function handleAddToCart() {
    dispatch(addItem({
      productId: product.id,
      name,
      reference: null,
      price: product.sale_price,
      imageUrl,
    }))
    setIsAdded(true)

    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setIsAdded(false), 1800)

    dispatch(openCart())
  }

  return (
    <article className="group flex h-full min-w-0 flex-col">
      <Link
        to={`/p/${product.id}`}
        aria-label={`Ver ${name}`}
        className="relative block aspect-square overflow-hidden rounded-[1.25rem] border border-zinc-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
      >
        {product.brand && (
          <span className="absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] truncate rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-zinc-700 shadow-sm backdrop-blur-sm">
            {product.brand.name}
          </span>
        )}

        {imageUrl ? (
          <img
            src={imageUrl}
            alt={image?.alt_text ?? name}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.025]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-300">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-9 w-9"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9" r="1.5" />
              <path d="m4 17 5-5 4 4 2-2 5 4" />
            </svg>
            <span className="text-[0.6875rem] font-medium">Imagen no disponible</span>
          </div>
        )}

        <span className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/[0.04] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </Link>

      <div className="flex flex-1 flex-col pt-5">
        <Link
          to={`/p/${product.id}`}
          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2"
        >
          <h2 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-zinc-900 transition-colors group-hover:text-zinc-700 sm:text-[0.9375rem]">
            {name}
          </h2>
        </Link>

        {product.description && (
          <p className="mt-2 line-clamp-2 min-h-9 text-xs leading-[1.125rem] text-zinc-500">
            {product.description}
          </p>
        )}

        <div className="mt-auto pt-4">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            Precio
          </p>
          <p className="mt-0.5 text-xl font-black tracking-tight text-zinc-950 sm:text-[1.4rem]">
            {priceFormatter.format(product.sale_price)}
          </p>

          <Button
            type="button"
            onClick={handleAddToCart}
            variant={isAdded ? 'success' : 'primary'}
            size="md"
            className="mt-3 w-full"
          >
            {isAdded ? <CheckIcon /> : <ShoppingBagIcon />}
            {isAdded ? 'Producto agregado' : 'Agregar al carrito'}
          </Button>
        </div>
      </div>
    </article>
  )
}

export function PublicProductCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden"
    >
      <div className="aspect-square animate-pulse rounded-[1.25rem] bg-zinc-100" />
      <div className="pt-5">
        <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-100" />
        <div className="mt-2 h-4 w-3/5 animate-pulse rounded bg-zinc-100" />
        <div className="mt-7 h-3 w-12 animate-pulse rounded bg-zinc-100" />
        <div className="mt-2 h-6 w-2/5 animate-pulse rounded bg-zinc-100" />
        <div className="mt-3 h-10 animate-pulse rounded-full bg-zinc-100" />
      </div>
    </div>
  )
}
