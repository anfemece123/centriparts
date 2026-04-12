import { useEffect, useState } from 'react'
import { Button, Input } from '@/shared/components/ui'
import { createCategory } from '@/modules/catalog/services/categories.service'
import type { Category } from '@/types'

interface Props {
  mode: 'main' | 'sub'
  parentId?: string
  parentName?: string
  onClose: () => void
  onCreate: (category: Category) => void
}

export default function CategoryCreateModal({
  mode,
  parentId,
  parentName,
  onClose,
  onCreate,
}: Props) {
  const [name, setName]         = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const cat = await createCategory({
        name: name.trim(),
        description: description.trim() || null,
        parent_id: parentId ?? null,
      })
      onCreate(cat)
    } catch {
      setError('No se pudo crear. Intente de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'main' ? 'Nueva categoría principal' : 'Nueva subcategoría'

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
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors text-lg leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
          {mode === 'sub' && parentName && (
            <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              Subcategoría de: <span className="font-semibold text-zinc-700">{parentName}</span>
            </div>
          )}

          <Input
            autoFocus
            label="Nombre *"
            id="modal_cat_name"
            placeholder={mode === 'main' ? 'Ej: Frenos' : 'Ej: Frenos Delanteros'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="modal_cat_desc" className="text-sm font-medium text-zinc-700">
              Descripción
            </label>
            <textarea
              id="modal_cat_desc"
              rows={2}
              placeholder="Descripción opcional…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!name.trim() || saving}>
              {saving ? 'Creando…' : 'Crear'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
