import { useEffect, useState } from 'react'
import { Button } from '@/shared/components/ui'
import {
  listCategories,
  assignProductToCategory,
  removeProductFromCategory,
} from '@/modules/catalog/services/categories.service'
import CategoryCreateModal from './CategoryCreateModal'
import type { Category } from '@/types'

// Shape returned by Supabase join on product_categories
export interface ProductCategoryRow {
  is_primary: boolean
  category: Category
}

interface Props {
  productId: string
  assignedCategories: ProductCategoryRow[]
  onRefresh: () => Promise<void>
}

type ModalMode = 'main' | 'sub' | null

export default function ProductCategorySection({
  productId,
  assignedCategories,
  onRefresh,
}: Props) {
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [busy, setBusy]                   = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [modalMode, setModalMode]         = useState<ModalMode>(null)

  useEffect(() => { loadCategories() }, [])

  async function loadCategories() {
    try {
      const cats = await listCategories()
      setAllCategories(cats)
    } catch {
      // non-critical — selectors will just be empty
    }
  }

  // ── Derived state ────────────────────────────────────────────────────────────

  const primaryRow     = assignedCategories.find((r) => r.is_primary) ?? null
  const nonPrimary     = assignedCategories.filter((r) => !r.is_primary)
  const subcategoryRow = primaryRow
    ? nonPrimary.find((r) => r.category.parent_id === primaryRow.category.id) ?? null
    : null
  const additionalRows = nonPrimary.filter((r) => r !== subcategoryRow)

  const mainCategories    = allCategories.filter((c) => c.parent_id === null)
  const subCategories     = primaryRow
    ? allCategories.filter((c) => c.parent_id === primaryRow.category.id)
    : []
  const assignedIds       = new Set(assignedCategories.map((r) => r.category.id))
  const availableAdditional = allCategories.filter((c) => !assignedIds.has(c.id))

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleSetMain(categoryId: string) {
    if (!categoryId) return
    setBusy(true)
    setError(null)
    try {
      await assignProductToCategory(productId, categoryId, true)
      await onRefresh()
    } catch {
      setError('No se pudo asignar la categoría principal.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveMain() {
    if (!primaryRow) return
    setBusy(true)
    setError(null)
    try {
      await removeProductFromCategory(productId, primaryRow.category.id)
      await onRefresh()
    } catch {
      setError('No se pudo quitar la categoría principal.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSetSub(categoryId: string) {
    setBusy(true)
    setError(null)
    try {
      if (subcategoryRow) {
        await removeProductFromCategory(productId, subcategoryRow.category.id)
      }
      if (categoryId) {
        await assignProductToCategory(productId, categoryId, false)
      }
      await onRefresh()
    } catch {
      setError('No se pudo asignar la subcategoría.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddAdditional(categoryId: string) {
    if (!categoryId) return
    setBusy(true)
    setError(null)
    try {
      await assignProductToCategory(productId, categoryId, false)
      await onRefresh()
    } catch {
      setError('No se pudo agregar la categoría.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(categoryId: string) {
    setBusy(true)
    setError(null)
    try {
      await removeProductFromCategory(productId, categoryId)
      await onRefresh()
    } catch {
      setError('No se pudo quitar la categoría.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCategoryCreated(cat: Category) {
    // Refresh the local category list, then auto-assign the new category
    await loadCategories()
    if (modalMode === 'main') {
      setModalMode(null)
      await handleSetMain(cat.id)
    } else if (modalMode === 'sub') {
      setModalMode(null)
      await handleSetSub(cat.id)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="px-5 py-5 flex flex-col gap-6">

        {/* ── Categoría principal ─────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Categoría principal
            </span>
            <button
              type="button"
              onClick={() => setModalMode('main')}
              className="text-xs font-medium text-yellow-600 hover:text-yellow-500 transition-colors"
            >
              + Nueva categoría
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={primaryRow?.category.id ?? ''}
              onChange={(e) => handleSetMain(e.target.value)}
              disabled={busy}
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:opacity-50"
            >
              <option value="">Sin categoría principal…</option>
              {mainCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {primaryRow && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={handleRemoveMain}
              >
                Quitar
              </Button>
            )}
          </div>
        </div>

        {/* ── Subcategoría principal (dependiente de la principal) ──── */}
        <div className="ml-4 border-l-2 border-zinc-100 pl-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Subcategoría principal
            </span>
            {primaryRow && (
              <button
                type="button"
                onClick={() => setModalMode('sub')}
                className="text-xs font-medium text-yellow-600 hover:text-yellow-500 transition-colors"
              >
                + Nueva subcategoría
              </button>
            )}
          </div>

          {!primaryRow ? (
            <p className="text-sm italic text-zinc-400">
              Selecciona una categoría principal primero
            </p>
          ) : subCategories.length === 0 && !subcategoryRow ? (
            <p className="text-sm italic text-zinc-400">
              No hay subcategorías.{' '}
              <button
                type="button"
                className="font-medium not-italic text-yellow-600 hover:underline"
                onClick={() => setModalMode('sub')}
              >
                Crear una
              </button>
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <select
                value={subcategoryRow?.category.id ?? ''}
                onChange={(e) => handleSetSub(e.target.value)}
                disabled={busy}
                className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:opacity-50"
              >
                <option value="">Sin subcategoría principal…</option>
                {subCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {subcategoryRow && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => handleRemove(subcategoryRow.category.id)}
                >
                  Quitar
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── Categorías adicionales ──────────────────────────────────── */}
        <div className="border-t border-zinc-100 pt-4 flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Categorías adicionales
          </span>

          {additionalRows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {additionalRows.map((row) => (
                <span
                  key={row.category.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700"
                >
                  {row.category.name}
                  <button
                    type="button"
                    onClick={() => handleRemove(row.category.id)}
                    disabled={busy}
                    className="text-zinc-400 hover:text-red-500 transition-colors disabled:opacity-50 leading-none text-base"
                    aria-label={`Quitar ${row.category.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {availableAdditional.length > 0 ? (
            <select
              value=""
              onChange={(e) => handleAddAdditional(e.target.value)}
              disabled={busy}
              className="rounded-md border border-dashed border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-500 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:opacity-50"
            >
              <option value="">+ Agregar categoría adicional…</option>
              {availableAdditional.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : additionalRows.length === 0 ? (
            <p className="text-sm italic text-zinc-400">Sin categorías adicionales</p>
          ) : null}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {/* ── Modales de creación ─────────────────────────────────────────── */}
      {modalMode && (
        <CategoryCreateModal
          mode={modalMode}
          parentId={modalMode === 'sub' ? primaryRow?.category.id : undefined}
          parentName={modalMode === 'sub' ? primaryRow?.category.name : undefined}
          onClose={() => setModalMode(null)}
          onCreate={handleCategoryCreated}
        />
      )}
    </>
  )
}
