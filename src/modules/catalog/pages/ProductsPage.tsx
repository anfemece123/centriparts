import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Card, Badge, Input } from '@/shared/components/ui'
import { listProducts } from '@/modules/catalog/services/products.service'
import { listProductTypes, listProductBrands } from '@/modules/catalog/services/brands.service'
import type { ProductListItem, ProductStatus, ProductType, ProductBrand } from '@/types'

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

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style:    'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

export default function ProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts]       = useState<ProductListItem[]>([])
  const [totalCount, setTotalCount]   = useState(0)
  const [page, setPage]               = useState(1)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState<ProductStatus | ''>('')
  const [typeFilter, setTypeFilter]   = useState('')
  const [brandFilter, setBrandFilter] = useState('')

  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [productBrands, setProductBrands] = useState<ProductBrand[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load filter options once on mount
  useEffect(() => {
    Promise.all([listProductTypes(), listProductBrands()])
      .then(([types, brands]) => {
        setProductTypes(types)
        setProductBrands(brands)
      })
      .catch(() => {/* non-critical — filters still work without options */})
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
  useEffect(() => { setPage(1) }, [statusFilter, typeFilter, brandFilter])

  // Fetch products whenever filters or page change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    listProducts({
      search:   search || undefined,
      status:   statusFilter || undefined,
      typeId:   typeFilter   || undefined,
      brandId:  brandFilter  || undefined,
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
  }, [search, statusFilter, typeFilter, brandFilter, page])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const pageStart  = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd    = Math.min(page * PAGE_SIZE, totalCount)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Productos"
        description={`${totalCount.toLocaleString('es-CO')} producto${totalCount !== 1 ? 's' : ''} en el catálogo`}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <Input
            placeholder="Buscar por nombre, CI o referencia…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ProductStatus | '')}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
        >
          <option value="">Todos los tipos</option>
          {productTypes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          value={brandFilter}
          onChange={(e) => { setBrandFilter(e.target.value); setPage(1) }}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
        >
          <option value="">Todas las marcas</option>
          {productBrands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card padding={false}>
        {error ? (
          <p className="px-6 py-10 text-center text-sm text-red-500">{error}</p>
        ) : loading ? (
          <p className="px-6 py-10 text-center text-sm text-zinc-400">Cargando productos…</p>
        ) : products.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-zinc-400">
            No se encontraron productos con los filtros aplicados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">CI</th>
                  <th className="px-4 py-3">Referencia</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Marca</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {products.map((product) => (
                  <tr
                    key={product.id}
                    onClick={() => navigate(`/admin/products/${product.id}`)}
                    className="cursor-pointer hover:bg-zinc-50"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      {product.display_name ?? product.base_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{product.ci}</td>
                    <td className="px-4 py-3 text-zinc-500">{product.reference ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {(product.type as { name: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {(product.brand as { name: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-900">
                      {priceFormatter.format(product.sale_price)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-900">
                      {product.stock.toLocaleString('es-CO')}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={STATUS_LABELS[product.status as ProductStatus]}
                        variant={STATUS_BADGE[product.status as ProductStatus]}
                      />
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
            Mostrando {pageStart}–{pageEnd} de {totalCount.toLocaleString('es-CO')} productos
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
