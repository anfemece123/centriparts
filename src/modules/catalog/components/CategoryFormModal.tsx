import { useEffect, useState } from 'react'
import { Button, Input } from '@/shared/components/ui'
import {
  createCategory,
  updateCategory,
} from '@/modules/catalog/services/categories.service'
import type { Category } from '@/types'

interface Props {
  mode: 'create' | 'edit'
  categoryType: 'main' | 'sub'
  parent?: Category   // required when categoryType === 'sub'
  initial?: Category  // required when mode === 'edit'
  onClose: () => void
  onSaved: () => void
}

export default function CategoryFormModal({
  mode,
  categoryType,
  parent,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [name, setName]               = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isActive, setIsActive]       = useState(initial?.is_active ?? true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const title =
    mode === 'create'
      ? categoryType === 'main'
        ? 'Nueva categoría'
        : 'Nueva subcategoría'
      : categoryType === 'main'
        ? 'Editar categoría'
        : 'Editar subcategoría'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (mode === 'create') {
        await createCategory({
          name: name.trim(),
          description: description.trim() || null,
          parent_id: parent?.id ?? null,
        })
      } else if (initial) {
        await updateCategory(initial.id, {
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
        })
      }
      onSaved()
    } catch {
      setError('No se pudo guardar. Intente de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-lg leading-none text-zinc-400 transition-colors hover:text-zinc-600"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
          {/* Parent info badge — shown for subcategories */}
          {categoryType === 'sub' && parent && (
            <div className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-2">
              <span className="text-xs text-zinc-400">Categoría padre:</span>
              <span className="text-xs font-semibold text-zinc-700">{parent.name}</span>
            </div>
          )}

          <Input
            autoFocus
            label="Nombre *"
            id="catform_name"
            placeholder={
              categoryType === 'main' ? 'Ej: Frenos' : 'Ej: Frenos Delanteros'
            }
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="catform_desc" className="text-sm font-medium text-zinc-700">
              Descripción
            </label>
            <textarea
              id="catform_desc"
              rows={2}
              placeholder="Descripción opcional…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
            />
          </div>

          {/* Active toggle — only in edit mode */}
          {mode === 'edit' && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 accent-yellow-400"
              />
              Categoría activa
            </label>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim() || saving}>
              {saving ? 'Guardando…' : mode === 'create' ? 'Crear' : 'Guardar cambios'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
