import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPublicProducts } from '@/modules/catalog/services/products.service'
import { listProductBrands } from '@/modules/catalog/services/brands.service'
import { listCategories } from '@/modules/catalog/services/categories.service'
import { getPublicImageUrl } from '@/modules/catalog/services/product-images.service'
import type { PublicProductListItem, ProductBrand, Category } from '@/types'

const PAGE_SIZE = 24

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

function resolveCardImage(
  images: PublicProductListItem['images'],
): PublicProductListItem['images'][number] | null {
  if (images.length === 0) return null
  const sorted = [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return a.display_order - b.display_order
  })
  return sorted[0]
}

function ProductCard({ product }: { product: PublicProductListItem }) {
  const image = resolveCardImage(product.images)
  const name = product.display_name ?? product.base_name

  return (
    <Link
      to={`/p/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-zinc-100">
        {image ? (
          <img
            src={getPublicImageUrl(image.storage_path)}
            alt={image.alt_text ?? name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-xs text-zinc-300">Sin imagen</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 p-4">
        {product.brand && (
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            {product.brand.name}
          </span>
        )}
        <h2 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900">
          {name}
        </h2>
        {product.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-zinc-400">
            {product.description}
          </p>
        )}
        <p className="mt-2 text-base font-bold text-zinc-900">
          {priceFormatter.format(product.sale_price)}
        </p>
      </div>
    </Link>
  )
}

const SELECT_CLASS =
  'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100'

export default function PublicCatalogPage() {
  const [products, setProducts] = useState<PublicProductListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [brandId, setBrandId] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const [brands, setBrands] = useState<ProductBrand[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load filter options once
  useEffect(() => {
    listProductBrands().then(setBrands).catch(() => {})
    listCategories().then(setCategories).catch(() => {})
  }, [])

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchInput])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [brandId, categoryId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    listPublicProducts({
      search: search || undefined,
      brandId: brandId || undefined,
      categoryId: categoryId || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then(({ data, count }) => {
        if (cancelled) return
        setProducts(data)
        setTotalCount(count)
      })
      .catch(() => {
        if (cancelled) return
        setError('No se pudieron cargar los productos.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [search, brandId, categoryId, page])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const hasActiveFilters = search || brandId || categoryId

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

      {/* Search + filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          type="search"
          placeholder="Buscar productos…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 sm:w-64"
        />

        {categories.length > 0 && (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className={`${SELECT_CLASS} w-full sm:w-auto`}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        {brands.length > 0 && (
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className={`${SELECT_CLASS} w-full sm:w-auto`}
          >
            <option value="">Todas las marcas</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}

        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setBrandId('')
              setCategoryId('')
            }}
            className="text-sm text-zinc-400 transition-colors hover:text-zinc-700"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Result count */}
      {!loading && !error && (
        <p className="mb-6 text-sm text-zinc-400">
          {totalCount === 0
            ? 'Sin resultados.'
            : `${totalCount.toLocaleString('es-CO')} producto${totalCount !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* States */}
      {error ? (
        <p className="py-24 text-center text-sm text-red-500">{error}</p>
      ) : loading ? (
        <p className="py-24 text-center text-sm text-zinc-400">Cargando productos…</p>
      ) : products.length === 0 ? (
        <p className="py-24 text-center text-sm text-zinc-400">
          No se encontraron productos.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-zinc-500 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
