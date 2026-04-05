import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge, Button, Input } from '@/shared/components/ui'
import {
  listCategories,
  createCategory,
  updateCategory,
} from '@/modules/catalog/services/categories.service'
import type { Category } from '@/types'

interface CategoryForm {
  name:        string
  description: string
  parent_id:   string
  is_active:   boolean
}

const EMPTY_FORM: CategoryForm = {
  name:        '',
  description: '',
  parent_id:   '',
  is_active:   true,
}

type FormMode = 'create' | 'edit'

export default function CategoriesPage() {
  const [categories, setCategories]   = useState<Category[]>([])
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState<string | null>(null)

  const [form, setForm]               = useState<CategoryForm>(EMPTY_FORM)
  const [formMode, setFormMode]       = useState<FormMode>('create')
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Build a name map for parent lookup without an extra query
  const nameMap = new Map(categories.map((c) => [c.id, c.name]))

  function load() {
    setLoading(true)
    setLoadError(null)
    listCategories({ includeInactive: true })
      .then(setCategories)
      .catch(() => setLoadError('No se pudieron cargar las categorías.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function startCreate() {
    setForm(EMPTY_FORM)
    setFormMode('create')
    setEditingId(null)
    setSaveError(null)
    setSaveSuccess(false)
  }

  function startEdit(category: Category) {
    setForm({
      name:        category.name,
      description: category.description ?? '',
      parent_id:   category.parent_id   ?? '',
      is_active:   category.is_active,
    })
    setFormMode('edit')
    setEditingId(category.id)
    setSaveError(null)
    setSaveSuccess(false)
  }

  async function handleSubmit() {
    if (!form.name.trim()) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim() || null,
        parent_id:   form.parent_id || null,
      }

      if (formMode === 'create') {
        await createCategory(payload)
      } else if (editingId) {
        await updateCategory(editingId, { ...payload, is_active: form.is_active })
      }

      load()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)

      if (formMode === 'create') setForm(EMPTY_FORM)
    } catch {
      setSaveError('No se pudo guardar la categoría. Intente de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  // Parent options: all categories except the one being edited
  const parentOptions = categories.filter((c) => c.id !== editingId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categorías"
        description="Categorías comerciales del catálogo"
        actions={
          <Button size="sm" onClick={startCreate}>
            + Nueva categoría
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Category list */}
        <div className="lg:col-span-2">
          <Card padding={false}>
            {loadError ? (
              <p className="px-6 py-10 text-center text-sm text-red-500">{loadError}</p>
            ) : loading ? (
              <p className="px-6 py-10 text-center text-sm text-zinc-400">Cargando categorías…</p>
            ) : categories.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-zinc-400">
                No hay categorías registradas. Crea la primera.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-4 py-3">Categoría padre</th>
                      <th className="px-4 py-3">Slug</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {categories.map((cat) => (
                      <tr
                        key={cat.id}
                        className={editingId === cat.id ? 'bg-yellow-50' : 'hover:bg-zinc-50'}
                      >
                        <td className="px-4 py-3 font-medium text-zinc-900">{cat.name}</td>
                        <td className="px-4 py-3 text-zinc-500">
                          {cat.parent_id ? (nameMap.get(cat.parent_id) ?? '—') : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-400">{cat.slug}</td>
                        <td className="px-4 py-3">
                          <Badge
                            label={cat.is_active ? 'Activa' : 'Inactiva'}
                            variant={cat.is_active ? 'success' : 'default'}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(cat)}
                          >
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Create / edit form */}
        <div>
          <Card>
            <h2 className="mb-5 text-sm font-semibold text-zinc-700">
              {formMode === 'create' ? 'Nueva categoría' : 'Editar categoría'}
            </h2>

            <div className="flex flex-col gap-4">
              <Input
                label="Nombre *"
                id="cat_name"
                placeholder="Ej: Frenos"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />

              <div className="flex flex-col gap-1">
                <label htmlFor="cat_description" className="text-sm font-medium text-zinc-700">
                  Descripción
                </label>
                <textarea
                  id="cat_description"
                  rows={3}
                  placeholder="Descripción opcional…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="resize-none rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="cat_parent" className="text-sm font-medium text-zinc-700">
                  Categoría padre
                </label>
                <select
                  id="cat_parent"
                  value={form.parent_id}
                  onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                >
                  <option value="">Sin categoría padre</option>
                  {parentOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {formMode === 'edit' && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    className="h-4 w-4 rounded border-zinc-300 accent-yellow-400"
                  />
                  Categoría activa
                </label>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-zinc-100 pt-5">
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={!form.name.trim() || saving}
                >
                  {saving ? 'Guardando…' : formMode === 'create' ? 'Crear categoría' : 'Guardar cambios'}
                </Button>

                {formMode === 'edit' && (
                  <Button variant="ghost" size="md" onClick={startCreate}>
                    Cancelar
                  </Button>
                )}
              </div>

              {saveSuccess && (
                <span className="text-sm text-green-600">
                  {formMode === 'create' ? 'Categoría creada correctamente.' : 'Cambios guardados correctamente.'}
                </span>
              )}
              {saveError && (
                <span className="text-sm text-red-500">{saveError}</span>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
