import { useEffect, useRef, useState } from 'react'
import type { ReactNode, SelectHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, Badge, Button } from '@/shared/components/ui'
import { listProducts } from '@/modules/catalog/services/products.service'
import { listProductTypes, listProductBrands } from '@/modules/catalog/services/brands.service'
import { listCategories } from '@/modules/catalog/services/categories.service'
import { getPublicImageUrl } from '@/modules/catalog/services/product-images.service'
import ProductSearchAutocomplete from '@/modules/catalog/components/ProductSearchAutocomplete'
import ProductCompatibilityTooltip from '@/modules/catalog/components/ProductCompatibilityTooltip'
import type {
  Category,
  ProductBrand,
  ProductListItem,
  ProductStatus,
  ProductType,
} from '@/types'

const PAGE_SIZE = 50

const STATUS_OPTIONS: { value: ProductStatus | ''; label: string }[] = [
  { value: '',          label: 'Todos los estados' },
  { value: 'draft',     label: 'Borrador' },
  { value: 'ready',     label: 'Listo' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived',  label: 'Archivado' },
]

const STATUS_LABELS: Record<ProductStatus, string> = {
  draft:     'Borrador',
  ready:     'Listo',
  published: 'Publicado',
  archived:  'Archivado',
}

const STATUS_BADGE: Record<ProductStatus, 'default' | 'info' | 'success' | 'danger'> = {
  draft:     'default',
  ready:     'info',
  published: 'success',
  archived:  'danger',
}

const SELECT_CLASS =
  'w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400'

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style:    'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

type ProductCategorySummary = {
  primary: ProductListItem['categories'][number]['category'] | null
  subcategory: ProductListItem['categories'][number]['category'] | null
}

function resolveProductImage(images: ProductListItem['images']) {
  if (!Array.isArray(images) || images.length === 0) return null
  return [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return a.display_order - b.display_order
  })[0]
}

function getProductCategorySummary(product: ProductListItem): ProductCategorySummary {
  const assignments = Array.isArray(product.categories) ? product.categories : []
  const primary =
    assignments.find((row) => row.is_primary)?.category ??
    assignments.find((row) => row.category.parent_id === null)?.category ??
    null

  const subcategory = primary
    ? assignments.find((row) => row.category.parent_id === primary.id)?.category ?? null
    : assignments.find((row) => row.category.parent_id !== null)?.category ?? null

  return { primary, subcategory }
}

function ImagePlaceholderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-7 w-7" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-5 4 4 2-2 5 4" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
    </svg>
  )
}

function ProductThumbnail({ product, className = 'h-[4.5rem] w-[4.5rem]' }: { product: ProductListItem; className?: string }) {
  const [imageFailed, setImageFailed] = useState(false)
  const image = resolveProductImage(product.images)
  const name = product.display_name ?? product.base_name
  const imageCount = Array.isArray(product.images) ? product.images.length : 0

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-white ${className}`}>
      {image && !imageFailed ? (
        <img
          src={getPublicImageUrl(image.storage_path)}
          alt={image.alt_text ?? `Imagen de ${name}`}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-zinc-50 text-zinc-300">
          <ImagePlaceholderIcon />
        </div>
      )}

      {imageCount > 1 && !imageFailed && (
        <span className="absolute bottom-1 right-1 rounded-full bg-zinc-950/80 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">
          +{imageCount - 1}
        </span>
      )}
    </div>
  )
}

interface FilterSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  children: ReactNode
}

function FilterSelect({ label, id, children, ...props }: FilterSelectProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <select id={id} className={SELECT_CLASS} {...props}>
        {children}
      </select>
    </div>
  )
}

function StockValue({ stock }: { stock: number }) {
  return (
    <div className="flex flex-col items-end">
      <span className={`font-semibold tabular-nums ${stock === 0 ? 'text-red-600' : 'text-zinc-900'}`}>
        {stock.toLocaleString('es-CO')}
      </span>
      <span className="text-[11px] text-zinc-400">{stock === 1 ? 'unidad' : 'unidades'}</span>
    </div>
  )
}

function MobileInfo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <div className="mt-1 truncate text-xs font-medium text-zinc-700">{children}</div>
    </div>
  )
}

function ProductListSkeleton() {
  return (
    <div className="divide-y divide-zinc-100" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-4 py-4 sm:px-5">
          <div className="h-[4.5rem] w-[4.5rem] shrink-0 animate-pulse rounded-xl bg-zinc-100" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-full max-w-xs animate-pulse rounded bg-zinc-100" />
            <div className="mt-2 h-3 w-40 animate-pulse rounded bg-zinc-100" />
          </div>
          <div className="hidden h-4 w-24 animate-pulse rounded bg-zinc-100 md:block" />
          <div className="hidden h-6 w-20 animate-pulse rounded-full bg-zinc-100 lg:block" />
        </div>
      ))}
    </div>
  )
}

export default function ProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [subcategoryFilter, setSubcategoryFilter] = useState('')

  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [productBrands, setProductBrands] = useState<ProductBrand[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [compatibilityPreview, setCompatibilityPreview] = useState<{
    product: ProductListItem
    anchorRect: DOMRect
  } | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    Promise.allSettled([
      listProductTypes(),
      listProductBrands(),
      listCategories({ includeInactive: true }),
    ])
      .then(([typesResult, brandsResult, categoriesResult]) => {
        if (typesResult.status === 'fulfilled') setProductTypes(typesResult.value)
        if (brandsResult.status === 'fulfilled') setProductBrands(brandsResult.value)
        if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value)
      })
  }, [])

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

  const filterKey = [
    statusFilter,
    typeFilter,
    brandFilter,
    categoryFilter,
    subcategoryFilter,
  ].join('|')
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
  }

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-deps-change pattern; state is reset before each request.
    setLoading(true)
    setError(null)

    listProducts({
      search: search || undefined,
      status: statusFilter || undefined,
      typeId: typeFilter || undefined,
      brandId: brandFilter || undefined,
      categoryId: categoryFilter || undefined,
      subcategoryId: subcategoryFilter || undefined,
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
        setError('No se pudieron cargar los productos. Intente de nuevo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [search, statusFilter, typeFilter, brandFilter, categoryFilter, subcategoryFilter, page])

  const mainCategories = categories.filter((category) => category.parent_id === null)
  const subcategories = categoryFilter
    ? categories.filter((category) => category.parent_id === categoryFilter)
    : []
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const pageStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(page * PAGE_SIZE, totalCount)
  const activeFilterCount = [
    search,
    statusFilter,
    typeFilter,
    brandFilter,
    categoryFilter,
    subcategoryFilter,
  ].filter(Boolean).length

  function handleCategoryChange(categoryId: string) {
    setCategoryFilter(categoryId)
    setSubcategoryFilter('')
  }

  function clearFilters() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearchInput('')
    setSearch('')
    setStatusFilter('')
    setTypeFilter('')
    setBrandFilter('')
    setCategoryFilter('')
    setSubcategoryFilter('')
    setPage(1)
  }

  function showCompatibilityPreview(product: ProductListItem, element: HTMLElement) {
    setCompatibilityPreview({ product, anchorRect: element.getBoundingClientRect() })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Productos"
        description={`${totalCount.toLocaleString('es-CO')} producto${totalCount !== 1 ? 's' : ''} en el catálogo`}
      />

      <Card padding={false} className="relative z-20 overflow-visible">
        <div className="flex items-center justify-between gap-4 rounded-t-lg border-b border-zinc-100 bg-zinc-50/70 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-zinc-600 shadow-sm ring-1 ring-zinc-200">
              <FilterIcon />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Filtros del catálogo</h2>
              <p className="text-xs text-zinc-400">
                {activeFilterCount > 0
                  ? `${activeFilterCount} filtro${activeFilterCount !== 1 ? 's' : ''} activo${activeFilterCount !== 1 ? 's' : ''}`
                  : 'Combine filtros para encontrar productos rápidamente'}
              </p>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <div className="sm:col-span-2 2xl:col-span-2">
            <ProductSearchAutocomplete
              id="product-search"
              label="Buscar producto"
              placeholder="Nombre, CI o referencia…"
              value={searchInput}
              onChange={setSearchInput}
              onSelectSuggestion={(suggestion) => {
                navigate(`/admin/products/${suggestion.id}`)
              }}
            />
          </div>

          <FilterSelect
            id="product-status-filter"
            label="Estado"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ProductStatus | '')}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="product-type-filter"
            label="Tipo"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="">Todos los tipos</option>
            {productTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="product-brand-filter"
            label="Marca"
            value={brandFilter}
            onChange={(event) => setBrandFilter(event.target.value)}
          >
            <option value="">Todas las marcas</option>
            {productBrands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="product-category-filter"
            label="Categoría"
            value={categoryFilter}
            onChange={(event) => handleCategoryChange(event.target.value)}
          >
            <option value="">Todas las categorías</option>
            {mainCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}{category.is_active ? '' : ' (inactiva)'}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="product-subcategory-filter"
            label="Subcategoría"
            value={subcategoryFilter}
            onChange={(event) => setSubcategoryFilter(event.target.value)}
            disabled={!categoryFilter || subcategories.length === 0}
          >
            <option value="">
              {!categoryFilter
                ? 'Seleccione una categoría'
                : subcategories.length === 0
                  ? 'Sin subcategorías'
                  : 'Todas las subcategorías'}
            </option>
            {subcategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}{category.is_active ? '' : ' (inactiva)'}
              </option>
            ))}
          </FilterSelect>
        </div>
      </Card>

      <Card padding={false} className="overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Listado de productos</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {loading
                ? 'Actualizando resultados…'
                : totalCount > 0
                  ? `Mostrando ${pageStart}–${pageEnd} de ${totalCount.toLocaleString('es-CO')}`
                  : 'Sin productos para mostrar'}
            </p>
          </div>
          {!loading && totalCount > 0 && (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
              {totalCount.toLocaleString('es-CO')} producto{totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <p className="text-sm font-medium text-red-600">{error}</p>
            <p className="text-xs text-zinc-400">Revise su conexión y vuelva a cargar la página.</p>
          </div>
        ) : loading ? (
          <ProductListSkeleton />
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              <ImagePlaceholderIcon />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-zinc-900">No se encontraron productos</h3>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-zinc-400">
              Pruebe con otros criterios o limpie los filtros para consultar todo el catálogo.
            </p>
            {activeFilterCount > 0 && (
              <Button type="button" variant="secondary" size="sm" className="mt-5" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-zinc-100 lg:hidden">
              {products.map((product) => {
                const name = product.display_name ?? product.base_name
                const { primary, subcategory } = getProductCategorySummary(product)

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => navigate(`/admin/products/${product.id}`)}
                    className="group w-full p-4 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-400 sm:p-5"
                  >
                    <div className="flex gap-4">
                      <ProductThumbnail product={product} className="h-20 w-20" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-zinc-900">{name}</h3>
                          <Badge
                            label={STATUS_LABELS[product.status]}
                            variant={STATUS_BADGE[product.status]}
                          />
                        </div>
                        {product.display_name && product.display_name !== product.base_name && (
                          <p className="mt-1 truncate text-xs text-zinc-400">{product.base_name}</p>
                        )}
                        <p className="mt-2 truncate font-mono text-[11px] text-zinc-500">
                          CI {product.ci}{product.reference ? ` · Ref. ${product.reference}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-zinc-50 p-3 sm:grid-cols-3">
                      <MobileInfo label="Categoría">
                        {primary?.name ?? 'Sin categoría'}
                      </MobileInfo>
                      <MobileInfo label="Subcategoría">
                        {subcategory?.name ?? 'Sin subcategoría'}
                      </MobileInfo>
                      <MobileInfo label="Marca">
                        {product.brand?.name ?? 'Sin marca'}
                      </MobileInfo>
                      <MobileInfo label="Tipo">
                        {product.type?.name ?? 'Sin tipo'}
                      </MobileInfo>
                      <MobileInfo label="Compatibilidad">
                        {product.compatibility.length > 0
                          ? `${product.compatibility.length} ${product.compatibility.length === 1 ? 'aplicación' : 'aplicaciones'}`
                          : 'Sin registrar'}
                      </MobileInfo>
                    </div>

                    <div className="mt-4 flex items-end justify-between border-t border-zinc-100 pt-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Precio</p>
                        <p className="mt-0.5 text-base font-bold text-zinc-950">
                          {priceFormatter.format(product.sale_price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-5">
                        <StockValue stock={product.stock} />
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-zinc-400 shadow-sm ring-1 ring-zinc-200 transition-colors group-hover:text-zinc-900">
                          <ChevronRightIcon />
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="min-w-[360px] px-5 py-3">Producto</th>
                    <th className="min-w-[190px] px-4 py-3">Categoría / subcategoría</th>
                    <th className="min-w-[150px] px-4 py-3">Marca / tipo</th>
                    <th className="px-4 py-3 text-right">Precio</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="w-12 px-4 py-3"><span className="sr-only">Abrir</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {products.map((product) => {
                    const name = product.display_name ?? product.base_name
                    const { primary, subcategory } = getProductCategorySummary(product)

                    return (
                      <tr
                        key={product.id}
                        role="link"
                        tabIndex={0}
                        aria-label={`Abrir producto ${name}`}
                        onClick={() => navigate(`/admin/products/${product.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            navigate(`/admin/products/${product.id}`)
                          }
                        }}
                        onMouseEnter={(event) => showCompatibilityPreview(product, event.currentTarget)}
                        onMouseLeave={() => setCompatibilityPreview(null)}
                        onFocus={(event) => showCompatibilityPreview(product, event.currentTarget)}
                        onBlur={() => setCompatibilityPreview(null)}
                        className="group cursor-pointer transition-colors hover:bg-zinc-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-400"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-4">
                            <ProductThumbnail product={product} />
                            <div className="min-w-0">
                              <p className="line-clamp-2 font-semibold leading-5 text-zinc-900">{name}</p>
                              {product.display_name && product.display_name !== product.base_name && (
                                <p className="mt-0.5 max-w-[290px] truncate text-xs text-zinc-400">{product.base_name}</p>
                              )}
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-zinc-500">
                                <span>CI {product.ci}</span>
                                {product.reference && (
                                  <>
                                    <span className="text-zinc-300">·</span>
                                    <span>Ref. {product.reference}</span>
                                  </>
                                )}
                              </div>
                              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-amber-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" aria-hidden="true" />
                                {product.compatibility.length > 0
                                  ? `${product.compatibility.length} ${product.compatibility.length === 1 ? 'aplicación compatible' : 'aplicaciones compatibles'}`
                                  : 'Sin compatibilidad registrada'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-zinc-700">{primary?.name ?? 'Sin categoría'}</p>
                          <p className="mt-1 text-xs text-zinc-400">
                            {subcategory ? `↳ ${subcategory.name}` : 'Sin subcategoría'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-zinc-700">{product.brand?.name ?? 'Sin marca'}</p>
                          <p className="mt-1 text-xs text-zinc-400">{product.type?.name ?? 'Sin tipo'}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right font-semibold tabular-nums text-zinc-900">
                          {priceFormatter.format(product.sale_price)}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <StockValue stock={product.stock} />
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            label={STATUS_LABELS[product.status]}
                            variant={STATUS_BADGE[product.status]}
                          />
                        </td>
                        <td className="px-4 py-4 text-zinc-300 transition-colors group-hover:text-zinc-700">
                          <ChevronRightIcon />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {!loading && totalCount > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 text-sm text-zinc-500 sm:flex-row">
          <span>
            Mostrando {pageStart}–{pageEnd} de {totalCount.toLocaleString('es-CO')} productos
          </span>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={page === 1}
              variant="secondary"
              size="sm"
            >
              Anterior
            </Button>
            <span className="whitespace-nowrap px-2 tabular-nums">
              Página {page} de {totalPages}
            </span>
            <Button
              onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
              disabled={page === totalPages}
              variant="secondary"
              size="sm"
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {compatibilityPreview && (
        <ProductCompatibilityTooltip
          product={compatibilityPreview.product}
          anchorRect={compatibilityPreview.anchorRect}
        />
      )}
    </div>
  )
}
