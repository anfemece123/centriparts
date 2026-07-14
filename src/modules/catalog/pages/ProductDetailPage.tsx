import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { PageHeader, Card, Badge, Button, Input } from '@/shared/components/ui'
import { getProductById, updateProductDetails } from '@/modules/catalog/services/products.service'
import { listProductBrands, listProductTypes } from '@/modules/catalog/services/brands.service'
import ProductImagesSection from '@/modules/catalog/components/ProductImagesSection'
import ProductCategorySection from '@/modules/catalog/components/ProductCategorySection'
import ProductCompatibilitySection from '@/modules/catalog/components/ProductCompatibilitySection'
import type { ProductCategoryRow } from '@/modules/catalog/components/ProductCategorySection'
import type { CompatibilityRow } from '@/modules/catalog/components/ProductCompatibilitySection'
import type {
  ProductBrand,
  ProductStatus,
  ProductType,
  ProductWithRelations,
} from '@/types'

const STATUS_OPTIONS: Array<{ value: ProductStatus; label: string; description: string }> = [
  { value: 'draft', label: 'Borrador', description: 'Solo visible en el panel administrativo.' },
  { value: 'ready', label: 'Listo', description: 'Preparado para una última revisión.' },
  { value: 'published', label: 'Publicado', description: 'Visible para los clientes en el catálogo.' },
  { value: 'archived', label: 'Archivado', description: 'Retirado del catálogo sin eliminarlo.' },
]

const STATUS_BADGE: Record<ProductStatus, 'default' | 'info' | 'success' | 'danger'> = {
  draft: 'default',
  ready: 'info',
  published: 'success',
  archived: 'danger',
}

const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Borrador',
  ready: 'Listo',
  published: 'Publicado',
  archived: 'Archivado',
}

const SELECT_CLASS =
  'h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400'

const priceFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

interface EditForm {
  base_name: string
  display_name: string
  reference: string
  description: string
  sale_price: string
  cost_price: string
  stock: string
  type_id: string
  brand_id: string
  status: ProductStatus
}

type FormErrors = Partial<Record<keyof EditForm, string>>

function formFromProduct(product: ProductWithRelations): EditForm {
  return {
    base_name: product.base_name,
    display_name: product.display_name ?? '',
    reference: product.reference ?? '',
    description: product.description ?? '',
    sale_price: String(product.sale_price),
    cost_price: String(product.cost_price),
    stock: String(product.stock),
    type_id: product.type_id ?? '',
    brand_id: product.brand_id ?? '',
    status: product.status,
  }
}

function comparableNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isFormDirty(form: EditForm, product: ProductWithRelations): boolean {
  return (
    form.base_name.trim() !== product.base_name ||
    form.display_name.trim() !== (product.display_name ?? '') ||
    form.reference.trim() !== (product.reference ?? '') ||
    form.description.trim() !== (product.description ?? '') ||
    comparableNumber(form.sale_price) !== Number(product.sale_price) ||
    comparableNumber(form.cost_price) !== Number(product.cost_price) ||
    comparableNumber(form.stock) !== Number(product.stock) ||
    form.type_id !== (product.type_id ?? '') ||
    form.brand_id !== (product.brand_id ?? '') ||
    form.status !== product.status
  )
}

function validateForm(form: EditForm): FormErrors {
  const errors: FormErrors = {}
  const salePrice = comparableNumber(form.sale_price)
  const costPrice = comparableNumber(form.cost_price)
  const stock = comparableNumber(form.stock)

  if (!form.base_name.trim()) {
    errors.base_name = 'El nombre base es obligatorio.'
  } else if (form.base_name.trim().length > 200) {
    errors.base_name = 'Use máximo 200 caracteres.'
  }

  if (form.display_name.trim().length > 200) {
    errors.display_name = 'Use máximo 200 caracteres.'
  }
  if (form.reference.trim().length > 120) {
    errors.reference = 'Use máximo 120 caracteres.'
  }
  if (form.description.trim().length > 3000) {
    errors.description = 'Use máximo 3.000 caracteres.'
  }

  if (salePrice === null || salePrice < 0) {
    errors.sale_price = 'Ingrese un precio de venta válido, igual o mayor a cero.'
  } else if (salePrice > 9_999_999_999.99) {
    errors.sale_price = 'El precio supera el máximo permitido.'
  }

  if (costPrice === null || costPrice < 0) {
    errors.cost_price = 'Ingrese un costo válido, igual o mayor a cero.'
  } else if (costPrice > 9_999_999_999.99) {
    errors.cost_price = 'El costo supera el máximo permitido.'
  }

  if (stock === null || stock < 0 || !Number.isInteger(stock)) {
    errors.stock = 'El stock debe ser un número entero igual o mayor a cero.'
  } else if (stock > 2_147_483_647) {
    errors.stock = 'El stock supera el máximo permitido.'
  }

  return errors
}

function IdentityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 5.5h12A1.5 1.5 0 0 1 19.5 7v10A1.5 1.5 0 0 1 18 18.5H6A1.5 1.5 0 0 1 4.5 17V7A1.5 1.5 0 0 1 6 5.5Z" />
      <path strokeLinecap="round" d="M8 9h8M8 12h8M8 15h5" />
    </svg>
  )
}

function InventoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 8 8-4 8 4-8 4-8-4Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 8 8 4 8-4v8l-8 4-8-4V8Z" />
      <path strokeLinecap="round" d="M12 12v8" />
    </svg>
  )
}

function ClassificationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.5h6v5h-6v-5ZM13.5 6.5h6v5h-6v-5ZM4.5 14.5h6v3h-6v-3ZM13.5 14.5h6v3h-6v-3Z" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 3.5h9l3 3V16.5H4v-13Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3.5v5h6v-5M7 16.5v-5h6v5" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 10 3.5 3.5 7.5-7.5" />
    </svg>
  )
}

function EditorSection({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="px-5 py-6 sm:px-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-amber-700 ring-1 ring-yellow-200">
          {icon}
        </span>
        <div>
          <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function SelectField({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
  children,
}: {
  id: string
  label: string
  hint?: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={SELECT_CLASS}
      >
        {children}
      </select>
      {hint && <p className="text-xs leading-relaxed text-zinc-400">{hint}</p>}
    </div>
  )
}

function ReadOnlyField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function UnsavedChangesDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onStay()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onStay])

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-zinc-950/50 px-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onStay()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="unsaved-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="px-6 py-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
            <SaveIcon />
          </span>
          <h2 id="unsaved-title" className="mt-4 text-base font-bold text-zinc-950">Tiene cambios sin guardar</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Si sale de esta página ahora, se perderán los cambios realizados en la información del producto.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 bg-zinc-50 px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onStay}>Seguir editando</Button>
          <Button type="button" variant="danger" onClick={onLeave}>Salir sin guardar</Button>
        </div>
      </div>
    </div>
  )
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [product, setProduct] = useState<ProductWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [productBrands, setProductBrands] = useState<ProductBrand[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState(false)

  const [form, setForm] = useState<EditForm>({
    base_name: '',
    display_name: '',
    reference: '',
    description: '',
    sale_price: '0',
    cost_price: '0',
    stock: '0',
    type_id: '',
    brand_id: '',
    status: 'draft',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showValidation, setShowValidation] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    getProductById(id)
      .then((data) => {
        if (cancelled) return
        if (!data) {
          setLoadError('Producto no encontrado.')
          return
        }
        setProduct(data)
        setForm(formFromProduct(data))
      })
      .catch(() => {
        if (!cancelled) setLoadError('No se pudo cargar el producto.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    let cancelled = false
    setOptionsLoading(true)
    setOptionsError(false)

    Promise.all([listProductTypes(), listProductBrands()])
      .then(([types, brands]) => {
        if (cancelled) return
        setProductTypes(types)
        setProductBrands(brands)
      })
      .catch(() => {
        if (!cancelled) setOptionsError(true)
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const dirty = product ? isFormDirty(form, product) : false
  const validationErrors = useMemo(() => validateForm(form), [form])
  const navigationBlocker = useBlocker(dirty && !saving)
  const salePrice = comparableNumber(form.sale_price) ?? 0
  const costPrice = comparableNumber(form.cost_price) ?? 0
  const currentStock = comparableNumber(form.stock) ?? 0
  const margin = salePrice - costPrice
  const marginPercent = salePrice > 0 ? (margin / salePrice) * 100 : 0
  const selectedStatus = STATUS_OPTIONS.find((option) => option.value === form.status)

  useEffect(() => {
    if (!dirty) return
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  useEffect(() => {
    if (!saveSuccess) return
    const timer = window.setTimeout(() => setSaveSuccess(false), 3500)
    return () => window.clearTimeout(timer)
  }, [saveSuccess])

  async function refreshProduct(resetEditor = false) {
    if (!id) return
    const refreshed = await getProductById(id)
    if (refreshed) {
      setProduct(refreshed)
      if (resetEditor) setForm(formFromProduct(refreshed))
    }
  }

  function updateField<Key extends keyof EditForm>(field: Key, value: EditForm[Key]) {
    setForm((current) => ({ ...current, [field]: value }))
    setSaveError(null)
    setSaveSuccess(false)
  }

  function resetEditor() {
    if (!product) return
    setForm(formFromProduct(product))
    setShowValidation(false)
    setSaveError(null)
    setSaveSuccess(false)
  }

  async function handleSave() {
    if (!product || !id) return

    if (Object.keys(validationErrors).length > 0) {
      setShowValidation(true)
      setSaveSuccess(false)
      setSaveError('Revise los campos marcados antes de guardar.')
      return
    }

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      await updateProductDetails(id, {
        base_name: form.base_name.trim(),
        display_name: form.display_name.trim() || null,
        reference: form.reference.trim() || null,
        description: form.description.trim() || null,
        sale_price: Number(form.sale_price),
        cost_price: Number(form.cost_price),
        stock: Number(form.stock),
        type_id: form.type_id || null,
        brand_id: form.brand_id || null,
        status: form.status,
      })

      await refreshProduct(true)
      setShowValidation(false)
      setSaveSuccess(true)
    } catch {
      setSaveError('No se pudieron guardar los cambios. Intente nuevamente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-yellow-400" aria-hidden="true" />
        <p className="text-sm text-zinc-400">Cargando información del producto…</p>
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

  const hasCurrentTypeOutsideOptions = product.type && !productTypes.some((type) => type.id === product.type?.id)
  const hasCurrentBrandOutsideOptions = product.brand && !productBrands.some((brand) => brand.id === product.brand?.id)

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        title={form.display_name.trim() || form.base_name.trim() || product.base_name}
        description={`CI ${product.ci} · Edición de producto`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate('/admin/products')}>
              ← Volver
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
              <SaveIcon />
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      />

      {dirty && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-amber-900">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
            <span><strong>Cambios pendientes.</strong> Guarde para actualizar el catálogo.</span>
          </div>
          <button type="button" onClick={resetEditor} className="self-start text-xs font-semibold text-amber-800 underline decoration-amber-300 underline-offset-4 hover:text-amber-950 sm:self-auto">
            Descartar cambios
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <ProductImagesSection
              productId={product.id}
              images={product.images}
              onRefresh={refreshProduct}
            />
          </Card>

          <Card padding={false} className="overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-zinc-100 bg-zinc-50/70 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-sm font-bold text-zinc-900">Información del producto</h2>
                <p className="mt-0.5 text-xs text-zinc-500">Edite la información comercial, inventario y publicación.</p>
              </div>
              <Badge label={STATUS_LABELS[form.status]} variant={STATUS_BADGE[form.status]} />
            </div>

            <div className="divide-y divide-zinc-100">
              <EditorSection
                icon={<IdentityIcon />}
                title="Identificación y contenido"
                description="Información utilizada para reconocer y presentar el producto en el catálogo."
              >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Input
                    label="Nombre base *"
                    id="base_name"
                    maxLength={200}
                    value={form.base_name}
                    error={showValidation ? validationErrors.base_name : undefined}
                    onChange={(event) => updateField('base_name', event.target.value)}
                  />
                  <Input
                    label="Nombre de presentación"
                    id="display_name"
                    maxLength={200}
                    placeholder="Nombre visible para el cliente"
                    value={form.display_name}
                    error={showValidation ? validationErrors.display_name : undefined}
                    onChange={(event) => updateField('display_name', event.target.value)}
                  />
                  <Input
                    label="Referencia"
                    id="reference"
                    maxLength={120}
                    placeholder="Ej. REF-12345"
                    value={form.reference}
                    error={showValidation ? validationErrors.reference : undefined}
                    onChange={(event) => updateField('reference', event.target.value)}
                  />
                  <Input
                    label="Código interno (CI)"
                    id="ci"
                    value={product.ci}
                    disabled
                    title="El CI está protegido porque identifica el producto en importaciones y pedidos."
                  />
                  <div className="flex flex-col gap-1 md:col-span-2">
                    <div className="flex items-center justify-between gap-4">
                      <label htmlFor="description" className="text-sm font-medium text-zinc-700">Descripción pública</label>
                      <span className={`text-[10px] tabular-nums ${form.description.length > 3000 ? 'text-red-500' : 'text-zinc-400'}`}>
                        {form.description.length.toLocaleString('es-CO')} / 3.000
                      </span>
                    </div>
                    <textarea
                      id="description"
                      rows={6}
                      maxLength={3200}
                      placeholder="Describa características, beneficios y recomendaciones del producto…"
                      value={form.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      className={`resize-y rounded-md border px-3 py-2.5 text-sm leading-relaxed text-zinc-900 placeholder-zinc-400 outline-none transition-colors ${
                        showValidation && validationErrors.description
                          ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                          : 'border-zinc-300 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100'
                      }`}
                    />
                    {showValidation && validationErrors.description && (
                      <span className="text-xs text-red-500">{validationErrors.description}</span>
                    )}
                    <p className="text-xs text-zinc-400">Esta descripción se muestra en la página pública del producto.</p>
                  </div>
                </div>
              </EditorSection>

              <EditorSection
                icon={<InventoryIcon />}
                title="Precios e inventario"
                description="Controle los valores comerciales y las unidades disponibles para la venta."
              >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <div>
                    <Input
                      label="Precio de venta *"
                      id="sale_price"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="9999999999.99"
                      step="0.01"
                      value={form.sale_price}
                      error={showValidation ? validationErrors.sale_price : undefined}
                      onChange={(event) => updateField('sale_price', event.target.value)}
                      className="font-mono tabular-nums"
                    />
                    {!validationErrors.sale_price && (
                      <p className="mt-1 text-xs text-zinc-400">{priceFormatter.format(salePrice)}</p>
                    )}
                  </div>
                  <div>
                    <Input
                      label="Costo *"
                      id="cost_price"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="9999999999.99"
                      step="0.01"
                      value={form.cost_price}
                      error={showValidation ? validationErrors.cost_price : undefined}
                      onChange={(event) => updateField('cost_price', event.target.value)}
                      className="font-mono tabular-nums"
                    />
                    {!validationErrors.cost_price && (
                      <p className="mt-1 text-xs text-zinc-400">{priceFormatter.format(costPrice)}</p>
                    )}
                  </div>
                  <div>
                    <Input
                      label="Stock disponible *"
                      id="stock"
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="2147483647"
                      step="1"
                      value={form.stock}
                      error={showValidation ? validationErrors.stock : undefined}
                      onChange={(event) => updateField('stock', event.target.value)}
                      className="font-mono tabular-nums"
                    />
                    {!validationErrors.stock && (
                      <p className={`mt-1 text-xs font-medium ${currentStock === 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                        {currentStock === 0 ? 'Producto sin existencias' : `${currentStock.toLocaleString('es-CO')} unidades disponibles`}
                      </p>
                    )}
                  </div>
                </div>

                <div className={`mt-5 flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                  margin < 0 ? 'border-red-200 bg-red-50' : 'border-emerald-100 bg-emerald-50/70'
                }`}>
                  <div>
                    <p className={`text-xs font-semibold ${margin < 0 ? 'text-red-700' : 'text-emerald-800'}`}>Margen estimado</p>
                    <p className={`mt-0.5 text-[11px] ${margin < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      Precio de venta menos costo del producto
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className={`text-sm font-bold tabular-nums ${margin < 0 ? 'text-red-700' : 'text-emerald-800'}`}>
                      {priceFormatter.format(margin)}
                    </p>
                    <p className={`text-[10px] font-semibold tabular-nums ${margin < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {marginPercent.toLocaleString('es-CO', { maximumFractionDigits: 1 })}% sobre la venta
                    </p>
                  </div>
                </div>
              </EditorSection>

              <EditorSection
                icon={<ClassificationIcon />}
                title="Clasificación y publicación"
                description="Organice el producto y controle si está visible para los clientes."
              >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <SelectField
                    id="type_id"
                    label="Tipo de producto"
                    value={form.type_id}
                    disabled={optionsLoading}
                    onChange={(value) => updateField('type_id', value)}
                  >
                    <option value="">Sin tipo asignado</option>
                    {hasCurrentTypeOutsideOptions && product.type && (
                      <option value={product.type.id}>{product.type.name}</option>
                    )}
                    {productTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </SelectField>

                  <SelectField
                    id="brand_id"
                    label="Marca del producto"
                    value={form.brand_id}
                    disabled={optionsLoading}
                    onChange={(value) => updateField('brand_id', value)}
                  >
                    <option value="">Sin marca asignada</option>
                    {hasCurrentBrandOutsideOptions && product.brand && (
                      <option value={product.brand.id}>{product.brand.name}</option>
                    )}
                    {productBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                  </SelectField>

                  <SelectField
                    id="status"
                    label="Estado de publicación"
                    value={form.status}
                    hint={selectedStatus?.description}
                    onChange={(value) => updateField('status', value as ProductStatus)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </SelectField>
                </div>

                {optionsError && (
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    No se pudieron actualizar las opciones de marcas y tipos. Puede editar los demás campos y volver a intentarlo más tarde.
                  </p>
                )}
              </EditorSection>
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-h-5" aria-live="polite">
                {saveSuccess && (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700"><CheckIcon /> Cambios guardados correctamente.</span>
                )}
                {saveError && <span className="text-sm font-medium text-red-600">{saveError}</span>}
                {!saveSuccess && !saveError && dirty && <span className="text-xs text-zinc-500">Hay información pendiente por guardar.</span>}
                {!saveSuccess && !saveError && !dirty && <span className="text-xs text-zinc-400">La información está actualizada.</span>}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={resetEditor} disabled={!dirty || saving}>
                  Cancelar
                </Button>
                <Button type="button" onClick={handleSave} disabled={!dirty || saving}>
                  <SaveIcon />
                  {saving ? 'Guardando cambios…' : 'Guardar cambios'}
                </Button>
              </div>
            </div>
          </Card>

          <Card padding={false}>
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-700">Categorías</h2>
            </div>
            <ProductCategorySection
              productId={product.id}
              assignedCategories={product.categories as unknown as ProductCategoryRow[]}
              onRefresh={refreshProduct}
            />
          </Card>

          <Card padding={false}>
            <ProductCompatibilitySection
              productId={product.id}
              compatibility={product.compatibility as unknown as CompatibilityRow[]}
              onRefresh={refreshProduct}
            />
          </Card>
        </div>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-6 xl:self-start">
          <Card padding={false} className="overflow-hidden">
            <div className="border-b border-zinc-100 bg-zinc-950 px-5 py-4 text-white">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Resumen comercial</p>
              <p className="mt-2 text-2xl font-black tabular-nums">{priceFormatter.format(salePrice)}</p>
              <p className="mt-1 text-xs text-zinc-400">Precio visible al cliente</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-zinc-100 border-b border-zinc-100">
              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Costo</p>
                <p className="mt-1 text-sm font-bold tabular-nums text-zinc-800">{priceFormatter.format(costPrice)}</p>
              </div>
              <div className="px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Margen</p>
                <p className={`mt-1 text-sm font-bold tabular-nums ${margin < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  {marginPercent.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%
                </p>
              </div>
            </div>
            <div className="px-5 py-5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-zinc-500">Inventario actual</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
                  currentStock === 0
                    ? 'bg-red-50 text-red-700'
                    : currentStock <= 5
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {currentStock.toLocaleString('es-CO')} unidades
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-zinc-500">Publicación</span>
                <Badge label={STATUS_LABELS[form.status]} variant={STATUS_BADGE[form.status]} />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-5 text-sm font-bold text-zinc-900">Control del registro</h2>
            <dl className="flex flex-col gap-4">
              <ReadOnlyField label="Código interno">
                <span className="font-mono text-sm font-semibold text-zinc-800">{product.ci}</span>
              </ReadOnlyField>
              <ReadOnlyField label="Identificador">
                <span className="block truncate font-mono text-[11px] text-zinc-500" title={product.id}>{product.id}</span>
              </ReadOnlyField>
              <div className="border-t border-zinc-100 pt-4">
                <ReadOnlyField label="Creado">
                  <span className="text-xs text-zinc-600">{formatDate(product.created_at)}</span>
                </ReadOnlyField>
              </div>
              <ReadOnlyField label="Última actualización">
                <span className="text-xs text-zinc-600">{formatDate(product.updated_at)}</span>
              </ReadOnlyField>
            </dl>
          </Card>

          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
            <strong>Consejo:</strong> use el nombre de presentación para mejorar cómo se ve el producto públicamente sin perder el nombre base del inventario.
          </div>
        </aside>
      </div>

      {navigationBlocker.state === 'blocked' && (
        <UnsavedChangesDialog
          onStay={() => navigationBlocker.reset()}
          onLeave={() => navigationBlocker.proceed()}
        />
      )}
    </div>
  )
}
