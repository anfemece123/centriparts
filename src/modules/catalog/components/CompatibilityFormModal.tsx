import { useEffect, useState } from 'react'
import { Button, Input } from '@/shared/components/ui'
import { listVehicleBrands, listVehicleModels } from '@/modules/catalog/services/brands.service'
import {
  addCompatibilityRow,
  updateCompatibilityRow,
} from '@/modules/catalog/services/compatibility.service'
import type { ProductCompatibility, VehicleBrand, VehicleModel } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

type CompatibilityRow = ProductCompatibility & {
  vehicle_brand: VehicleBrand | null
  vehicle_model: VehicleModel | null
}

interface Props {
  mode: 'add' | 'edit'
  productId: string
  initial?: CompatibilityRow
  onClose: () => void
  onSaved: () => void
}

// ── Current year helper ───────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()

// ── Component ─────────────────────────────────────────────────────────────────

export default function CompatibilityFormModal({
  mode,
  productId,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [brands, setBrands]           = useState<VehicleBrand[]>([])
  const [models, setModels]           = useState<VehicleModel[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [modelsLoading, setModelsLoading] = useState(false)

  const [brandId, setBrandId]   = useState(initial?.vehicle_brand_id ?? '')
  const [modelId, setModelId]   = useState(initial?.vehicle_model_id ?? '')
  const [yearFrom, setYearFrom] = useState(initial?.year_from?.toString() ?? '')
  const [yearTo, setYearTo]     = useState(initial?.year_to?.toString() ?? '')
  const [notes, setNotes]       = useState(initial?.notes ?? '')

  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Load brands on mount
  useEffect(() => {
    listVehicleBrands()
      .then(setBrands)
      .catch(() => setError('No se pudieron cargar las marcas.'))
      .finally(() => setBrandsLoading(false))
  }, [])

  // Reload models when brand changes
  useEffect(() => {
    if (!brandId) {
      setModels([])
      return
    }
    setModelsLoading(true)
    listVehicleModels(brandId)
      .then(setModels)
      .catch(() => {})
      .finally(() => setModelsLoading(false))
  }, [brandId])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleBrandChange(newBrandId: string) {
    setBrandId(newBrandId)
    setModelId('') // cascade reset
  }

  function validate(): string | null {
    const from = yearFrom ? parseInt(yearFrom, 10) : null
    const to   = yearTo   ? parseInt(yearTo,   10) : null
    if (from !== null && (from < 1900 || from > CURRENT_YEAR + 2)) {
      return `Año desde inválido (1900–${CURRENT_YEAR + 2}).`
    }
    if (to !== null && (to < 1900 || to > CURRENT_YEAR + 2)) {
      return `Año hasta inválido (1900–${CURRENT_YEAR + 2}).`
    }
    if (from !== null && to !== null && to < from) {
      return 'El año hasta no puede ser menor que el año desde.'
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSaving(true)
    setError(null)

    const payload = {
      vehicle_brand_id: brandId || null,
      vehicle_model_id: modelId || null,
      year_from: yearFrom ? parseInt(yearFrom, 10) : null,
      year_to:   yearTo   ? parseInt(yearTo,   10) : null,
      notes: notes.trim() || null,
    }

    try {
      if (mode === 'add') {
        await addCompatibilityRow(productId, payload)
      } else if (initial) {
        await updateCompatibilityRow(initial.id, payload)
      }
      onSaved()
    } catch {
      setError('No se pudo guardar. Intente de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'add' ? 'Agregar compatibilidad' : 'Editar compatibilidad'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
            {mode === 'edit' && (
              <p className="mt-0.5 text-xs text-zinc-400">
                Al guardar se marcará como verificado y manual.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none text-zinc-400 transition-colors hover:text-zinc-600"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">

          {/* Brand selector */}
          <div className="flex flex-col gap-1">
            <label htmlFor="compat_brand" className="text-sm font-medium text-zinc-700">
              Marca de vehículo
            </label>
            <select
              id="compat_brand"
              value={brandId}
              onChange={(e) => handleBrandChange(e.target.value)}
              disabled={brandsLoading}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:opacity-50"
            >
              <option value="">
                {brandsLoading ? 'Cargando…' : 'Todas las marcas / Sin especificar'}
              </option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Model selector — dependent on brand */}
          <div className="flex flex-col gap-1">
            <label htmlFor="compat_model" className="text-sm font-medium text-zinc-700">
              Modelo de vehículo
            </label>
            <select
              id="compat_model"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              disabled={!brandId || modelsLoading}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:opacity-50"
            >
              <option value="">
                {!brandId
                  ? 'Selecciona una marca primero'
                  : modelsLoading
                    ? 'Cargando modelos…'
                    : models.length === 0
                      ? 'No hay modelos registrados'
                      : 'Todos los modelos / Sin especificar'}
              </option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Year range */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Año desde"
              id="compat_year_from"
              type="number"
              min={1900}
              max={CURRENT_YEAR + 2}
              placeholder="Ej: 2010"
              value={yearFrom}
              onChange={(e) => setYearFrom(e.target.value)}
            />
            <Input
              label="Año hasta"
              id="compat_year_to"
              type="number"
              min={1900}
              max={CURRENT_YEAR + 2}
              placeholder="Ej: 2020"
              value={yearTo}
              onChange={(e) => setYearTo(e.target.value)}
            />
          </div>

          {/* Notes */}
          <Input
            label="Notas"
            id="compat_notes"
            placeholder="Ej: Motor 1.4/1.6 (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Guardando…' : mode === 'add' ? 'Agregar' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
