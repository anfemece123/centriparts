import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader, Card, Badge, Button, Input } from '@/shared/components/ui'
import { getProductById, updateProductDetails, updateProductStatus } from '@/modules/catalog/services/products.service'
import ProductImagesSection from '@/modules/catalog/components/ProductImagesSection'
import ProductCategorySection from '@/modules/catalog/components/ProductCategorySection'
import ProductCompatibilitySection from '@/modules/catalog/components/ProductCompatibilitySection'
import type { ProductCategoryRow } from '@/modules/catalog/components/ProductCategorySection'
import type { CompatibilityRow } from '@/modules/catalog/components/ProductCompatibilitySection'
import type { ProductWithRelations, ProductStatus } from '@/types'

const STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'draft',     label: 'Borrador' },
  { value: 'ready',     label: 'Listo' },
  { value: 'published', label: 'Publicado' },
  { value: 'archived',  label: 'Archivado' },
]

const STATUS_BADGE: Record<ProductStatus, 'default' | 'info' | 'success' | 'danger'> = {
  draft:     'default',
  ready:     'info',
  published: 'success',
  archived:  'danger',
}

const STATUS_LABELS: Record<ProductStatus, string> = {
  draft:     'Borrador',
  ready:     'Listo',
  published: 'Publicado',
  archived:  'Archivado',
}


const priceFormatter = new Intl.NumberFormat('es-CO', {
  style:    'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

interface EditForm {
  display_name: string
  description:  string
  status:       ProductStatus
}

function formFromProduct(p: ProductWithRelations): EditForm {
  return {
    display_name: p.display_name ?? '',
    description:  p.description  ?? '',
    status:       p.status,
  }
}

function isFormDirty(form: EditForm, product: ProductWithRelations): boolean {
  return (
    form.display_name !== (product.display_name ?? '') ||
    form.description  !== (product.description  ?? '') ||
    form.status       !== product.status
  )
}

export default function ProductDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [product, setProduct]   = useState<ProductWithRelations | null>(null)
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [form, setForm]         = useState<EditForm>({ display_name: '', description: '', status: 'draft' })
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setLoadError(null)

    getProductById(id)
      .then((data) => {
        if (!data) {
          setLoadError('Producto no encontrado.')
          return
        }
        setProduct(data)
        setForm(formFromProduct(data))
      })
      .catch(() => setLoadError('No se pudo cargar el producto.'))
      .finally(() => setLoading(false))
  }, [id])

  const dirty = product ? isFormDirty(form, product) : false

  async function refreshProduct() {
    if (!id) return
    const refreshed = await getProductById(id)
    if (refreshed) {
      setProduct(refreshed)
      setForm(formFromProduct(refreshed))
    }
  }

  async function handleSave() {
    if (!product || !id) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      await updateProductDetails(id, {
        display_name: form.display_name.trim() || null,
        description:  form.description.trim()  || null,
      })

      if (form.status !== product.status) {
        await updateProductStatus(id, form.status)
      }

      await refreshProduct()

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError('No se pudieron guardar los cambios. Intente de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-zinc-400">Cargando producto…</p>
      </div>
    )
  }

  if (loadError || !product) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p className="text-sm text-red-500">{loadError ?? 'Producto no encontrado.'}</p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/admin/products')}>
          Volver a productos
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={product.display_name ?? product.base_name}
        description={`CI: ${product.ci}`}
        actions={
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/products')}>
            ← Volver a productos
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Left column — editable + compatibility */}
        <div className="flex flex-col gap-6 lg:col-span-2">

          {/* Product images */}
          <Card>
            <ProductImagesSection
              productId={product.id}
              images={product.images}
              onRefresh={refreshProduct}
            />
          </Card>

          {/* Editable fields */}
          <Card>
            <h2 className="mb-5 text-sm font-semibold text-zinc-700">Información editable</h2>

            <div className="flex flex-col gap-5">
              <Input
                label="Nombre de presentación"
                id="display_name"
                placeholder={product.base_name}
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="description" className="text-sm font-medium text-zinc-700">
                  Descripción
                </label>
                <textarea
                  id="description"
                  rows={4}
                  placeholder="Descripción del producto…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="status" className="text-sm font-medium text-zinc-700">
                  Estado
                </label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProductStatus }))}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 border-t border-zinc-100 pt-5">
              <Button
                onClick={handleSave}
                disabled={!dirty || saving}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>

              {saveSuccess && (
                <span className="text-sm text-green-600">Cambios guardados correctamente.</span>
              )}
              {saveError && (
                <span className="text-sm text-red-500">{saveError}</span>
              )}
            </div>
          </Card>

          {/* Category assignment */}
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-700">Categorías</h2>
            </div>
            <ProductCategorySection
              productId={product.id}
              assignedCategories={product.categories as unknown as ProductCategoryRow[]}
              onRefresh={refreshProduct}
            />
          </Card>

          {/* Compatibility */}
          <Card padding={false}>
            <ProductCompatibilitySection
              productId={product.id}
              compatibility={product.compatibility as unknown as CompatibilityRow[]}
              onRefresh={refreshProduct}
            />
          </Card>
        </div>

        {/* Right column — read-only info */}
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-5 text-sm font-semibold text-zinc-700">Información del producto</h2>

            <dl className="flex flex-col gap-4">
              <ReadOnlyField label="Estado actual">
                <Badge
                  label={STATUS_LABELS[product.status]}
                  variant={STATUS_BADGE[product.status]}
                />
              </ReadOnlyField>

              <ReadOnlyField label="CI">
                <span className="font-mono text-sm text-zinc-800">{product.ci}</span>
              </ReadOnlyField>

              <ReadOnlyField label="Nombre base">
                <span className="text-sm text-zinc-800">{product.base_name}</span>
              </ReadOnlyField>

              {product.reference && (
                <ReadOnlyField label="Referencia">
                  <span className="text-sm text-zinc-800">{product.reference}</span>
                </ReadOnlyField>
              )}

              <ReadOnlyField label="Precio de venta">
                <span className="text-sm font-medium text-zinc-800">
                  {priceFormatter.format(product.sale_price)}
                </span>
              </ReadOnlyField>

              <ReadOnlyField label="Stock">
                <span className="text-sm text-zinc-800">
                  {product.stock.toLocaleString('es-CO')} unidades
                </span>
              </ReadOnlyField>

              {product.type && (
                <ReadOnlyField label="Tipo">
                  <span className="text-sm text-zinc-800">{product.type.name}</span>
                </ReadOnlyField>
              )}

              {product.brand && (
                <ReadOnlyField label="Marca">
                  <span className="text-sm text-zinc-800">{product.brand.name}</span>
                </ReadOnlyField>
              )}

              <div className="border-t border-zinc-100 pt-4">
                <ReadOnlyField label="Creado">
                  <span className="text-xs text-zinc-500">{formatDate(product.created_at)}</span>
                </ReadOnlyField>
              </div>

              <ReadOnlyField label="Actualizado">
                <span className="text-xs text-zinc-500">{formatDate(product.updated_at)}</span>
              </ReadOnlyField>
            </dl>
          </Card>
        </div>

      </div>
    </div>
  )
}

function ReadOnlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
