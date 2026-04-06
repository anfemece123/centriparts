import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getProductById } from '@/modules/catalog/services/products.service'
import { getPublicImageUrl } from '@/modules/catalog/services/product-images.service'
import { useAppDispatch } from '@/store'
import { addItem, openCart } from '@/modules/cart/store/cartSlice'
import type { ProductWithRelations, ProductImage } from '@/types'

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

function resolveInitialImage(images: ProductImage[]): ProductImage | null {
  if (images.length === 0) return null
  return images.find((img) => img.is_primary) ?? images[0]
}

export default function PublicProductPage() {
  const { id }   = useParams<{ id: string }>()
  const dispatch = useAppDispatch()

  const [product, setProduct] = useState<ProductWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const [activeImage, setActiveImage] = useState<ProductImage | null>(null)
  const [addedFeedback, setAddedFeedback] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)

    getProductById(id)
      .then((data) => {
        if (!data) {
          setError('Producto no encontrado.')
          return
        }
        setProduct(data)
        setActiveImage(resolveInitialImage(data.images))
      })
      .catch(() => setError('No se pudo cargar el producto.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-sm text-zinc-400">Cargando producto…</p>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-sm text-red-500">{error ?? 'Producto no encontrado.'}</p>
      </div>
    )
  }

  const name     = product.display_name ?? product.base_name
  const imageUrl = activeImage ? getPublicImageUrl(activeImage.storage_path) : null

  function handleAddToCart() {
    dispatch(addItem({
      productId: product.id,
      name,
      reference: product.reference,
      price:     product.sale_price,
      imageUrl,
    }))
    dispatch(openCart())
    setAddedFeedback(true)
    setTimeout(() => setAddedFeedback(false), 2000)
  }
  const sorted = [...product.images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return a.display_order - b.display_order
  })

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">

          {/* Image gallery */}
          <div className="flex flex-col gap-3">
            {/* Main image */}
            <div className="aspect-square w-full overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
              {activeImage ? (
                <img
                  src={getPublicImageUrl(activeImage.storage_path)}
                  alt={activeImage.alt_text ?? name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="text-sm text-zinc-300">Sin imagen</span>
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {sorted.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sorted.map((img) => {
                  const isActive = activeImage?.id === img.id
                  return (
                    <button
                      key={img.id}
                      onClick={() => setActiveImage(img)}
                      className={[
                        'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                        isActive
                          ? 'border-yellow-400'
                          : 'border-transparent hover:border-zinc-300',
                      ].join(' ')}
                    >
                      <img
                        src={getPublicImageUrl(img.storage_path)}
                        alt={img.alt_text ?? name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Product info */}
          <div className="flex flex-col gap-6 pt-1">
            {product.brand && (
              <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                {product.brand.name}
              </span>
            )}

            <h1 className="text-2xl font-bold leading-snug text-zinc-900">{name}</h1>

            {product.reference && (
              <p className="text-sm text-zinc-400">Ref: {product.reference}</p>
            )}

            <p className="text-3xl font-bold text-zinc-900">
              {priceFormatter.format(product.sale_price)}
            </p>

            <button
              onClick={handleAddToCart}
              className="mt-2 w-full rounded-xl bg-yellow-400 py-3.5 text-sm font-bold text-black transition-colors hover:bg-yellow-500 sm:w-auto sm:px-8"
            >
              {addedFeedback ? '¡Agregado al carrito!' : 'Agregar al carrito'}
            </button>

            {product.description && (
              <div className="border-t border-zinc-100 pt-5">
                <p className="text-sm leading-relaxed text-zinc-600">{product.description}</p>
              </div>
            )}

            {product.type && (
              <p className="text-sm text-zinc-400">
                Tipo: <span className="text-zinc-600">{product.type.name}</span>
              </p>
            )}
          </div>

        </div>
    </div>
  )
}
