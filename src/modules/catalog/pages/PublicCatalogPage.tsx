import { useEffect, useRef, useState } from 'react'
import type { ReactNode, SelectHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import { listPublicProducts } from '@/modules/catalog/services/products.service'
import { listProductBrands, listProductTypes } from '@/modules/catalog/services/brands.service'
import { listCategories } from '@/modules/catalog/services/categories.service'
import VisualSearchModal from '@/modules/catalog/components/VisualSearchModal'
import ProductSearchAutocomplete from '@/modules/catalog/components/ProductSearchAutocomplete'
import PublicProductCard, {
  PublicProductCardSkeleton,
} from '@/modules/catalog/components/PublicProductCard'
import type { PublicProductListItem, ProductBrand, ProductType, Category } from '@/types'
import { Button } from '@/shared/components/ui'

const PAGE_SIZE = 24

const SELECT_CLASS =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400'

type PublicProductSort = 'newest' | 'price-asc' | 'price-desc'

interface CatalogSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  children: ReactNode
}

function CatalogSelect({ label, id, children, ...props }: CatalogSelectProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-zinc-600">
        {label}
      </label>
      <select id={id} className={SELECT_CLASS} {...props}>
        {children}
      </select>
    </div>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7.5h3l1.2-2h7.6l1.2 2h3a1.5 1.5 0 011.5 1.5v9A1.5 1.5 0 0120 19.5H4A1.5 1.5 0 012.5 18V9A1.5 1.5 0 014 7.5z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

export default function PublicCatalogPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<PublicProductListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [sort, setSort] = useState<PublicProductSort>('newest')

  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [brands, setBrands] = useState<ProductBrand[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [visualSearchOpen, setVisualSearchOpen] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load filter options once
  useEffect(() => {
    Promise.allSettled([
      listProductTypes(),
      listProductBrands(),
      listCategories(),
    ]).then(([typesResult, brandsResult, categoriesResult]) => {
      if (typesResult.status === 'fulfilled') setProductTypes(typesResult.value)
      if (brandsResult.status === 'fulfilled') setBrands(brandsResult.value)
      if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value)
    })
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

  // Reset page when filters change. Adjusted during render (React's
  // documented pattern for "adjusting state when a prop/dependency changes")
  // rather than inside an Effect.
  const filterKey = `${typeId}|${brandId}|${categoryId}|${subcategoryId}|${sort}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-deps-change pattern; state is reset synchronously so the previous page's data/error never flashes while the new request is in flight.
    setLoading(true)
    setError(null)

    listPublicProducts({
      search: search || undefined,
      typeId: typeId || undefined,
      brandId: brandId || undefined,
      categoryId: categoryId || undefined,
      subcategoryId: subcategoryId || undefined,
      sort,
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
  }, [search, typeId, brandId, categoryId, subcategoryId, sort, page])

  const mainCategories = categories.filter((category) => category.parent_id === null)
  const subcategories = categoryId
    ? categories.filter((category) => category.parent_id === categoryId)
    : []
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const activeFilterCount = [
    search,
    typeId,
    brandId,
    categoryId,
    subcategoryId,
  ].filter(Boolean).length
  const hasCustomSort = sort !== 'newest'
  const hasActiveFilters = activeFilterCount > 0 || hasCustomSort

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId)
    setSubcategoryId('')
  }

  function clearFilters() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearchInput('')
    setSearch('')
    setTypeId('')
    setBrandId('')
    setCategoryId('')
    setSubcategoryId('')
    setSort('newest')
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">

      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-yellow-600">
          Electricidad y electrónica automotriz
        </p>
        <h1 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
          Catálogo de componentes eléctricos y electrónicos
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-base">
          Explore productos para sistemas eléctricos, electrónicos, de encendido, carga,
          iluminación y control automotriz.
        </p>
      </div>

      {/* Search + filter bar */}
      <div className="mb-5 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <ProductSearchAutocomplete
              id="public-product-search"
              label="Buscar en el catálogo"
              placeholder="Producto, CI o referencia…"
              value={searchInput}
              onChange={setSearchInput}
              publicOnly
              onSelectSuggestion={(suggestion) => {
                navigate(`/p/${suggestion.id}`)
              }}
            />
          </div>

          <div className="group relative shrink-0">
            <Button
              type="button"
              onClick={() => setVisualSearchOpen(true)}
              variant="secondary"
              title="Buscar componente por foto"
              aria-label="Buscar componente por foto"
              aria-describedby="visual-search-tooltip"
              className="h-10 w-10 px-0"
            >
              <CameraIcon />
            </Button>
            <span
              id="visual-search-tooltip"
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-max max-w-52 rounded-lg bg-zinc-950 px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              Buscar componente por foto
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <CatalogSelect
            id="public-type-filter"
            label="Tipo"
            value={typeId}
            onChange={(event) => setTypeId(event.target.value)}
          >
            <option value="">Todos los tipos</option>
            {productTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </CatalogSelect>

          <CatalogSelect
            id="public-category-filter"
            label="Categoría"
            value={categoryId}
            onChange={(event) => handleCategoryChange(event.target.value)}
          >
            <option value="">Todas las categorías</option>
            {mainCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </CatalogSelect>

          <CatalogSelect
            id="public-subcategory-filter"
            label="Subcategoría"
            value={subcategoryId}
            onChange={(event) => setSubcategoryId(event.target.value)}
            disabled={!categoryId || subcategories.length === 0}
          >
            <option value="">
              {!categoryId
                ? 'Seleccione una categoría'
                : subcategories.length === 0
                  ? 'Sin subcategorías'
                  : 'Todas las subcategorías'}
            </option>
            {subcategories.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
            ))}
          </CatalogSelect>

          <CatalogSelect
            id="public-brand-filter"
            label="Marca"
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
          >
            <option value="">Todas las marcas</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </CatalogSelect>

          <CatalogSelect
            id="public-sort-filter"
            label="Ordenar por"
            value={sort}
            onChange={(event) => setSort(event.target.value as PublicProductSort)}
          >
            <option value="newest">Más recientes</option>
            <option value="price-asc">Menor precio</option>
            <option value="price-desc">Mayor precio</option>
          </CatalogSelect>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 flex items-center justify-between gap-4 border-t border-zinc-200 pt-3">
            <p className="text-xs text-zinc-400">
              {activeFilterCount > 0
                ? `${activeFilterCount} filtro${activeFilterCount !== 1 ? 's' : ''} activo${activeFilterCount !== 1 ? 's' : ''}${hasCustomSort ? ' · orden personalizado' : ''}`
                : 'Orden personalizado'}
            </p>
            <Button type="button" onClick={clearFilters} variant="ghost" size="sm">
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Result count */}
      {!loading && !error && (
        <p className="mb-6 text-sm text-zinc-400">
          {totalCount === 0
            ? '0 productos encontrados'
            : `${totalCount.toLocaleString('es-CO')} producto${totalCount !== 1 ? 's' : ''} encontrado${totalCount !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* States */}
      {error ? (
        <p className="py-24 text-center text-sm text-red-500">{error}</p>
      ) : loading ? (
        <div
          role="status"
          className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4"
        >
          <span className="sr-only">Cargando productos…</span>
          {Array.from({ length: 8 }, (_, index) => (
            <PublicProductCardSkeleton key={index} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="py-24 text-center text-sm text-zinc-400">
          {search || typeId || brandId
            ? 'No encontramos productos que coincidan con su búsqueda. Intente utilizar otra referencia, nombre o categoría.'
            : categoryId || subcategoryId
              ? 'Actualmente no hay productos disponibles en esta categoría.'
              : 'Actualmente no hay productos disponibles en el catálogo.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-3 min-[440px]:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <PublicProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="mt-10 flex items-center justify-center gap-3">
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            variant="secondary"
            size="sm"
          >
            Anterior
          </Button>
          <span className="text-sm text-zinc-500 tabular-nums">
            {page} / {totalPages}
          </span>
          <Button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            variant="secondary"
            size="sm"
          >
            Siguiente
          </Button>
        </div>
      )}

      {visualSearchOpen && <VisualSearchModal onClose={() => setVisualSearchOpen(false)} />}
    </div>
  )
}
