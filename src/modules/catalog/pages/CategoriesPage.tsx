import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge, Button, ConfirmModal } from '@/shared/components/ui'
import {
  listCategories,
  deleteCategory,
} from '@/modules/catalog/services/categories.service'
import CategoryFormModal from '@/modules/catalog/components/CategoryFormModal'
import type { Category } from '@/types'

// ── Modal state discriminated union ──────────────────────────────────────────

type ModalState =
  | { type: 'create-main' }
  | { type: 'create-sub'; parent: Category }
  | { type: 'edit-main'; category: Category }
  | { type: 'edit-sub'; category: Category; parent: Category }
  | { type: 'delete'; category: Category; subCount: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildGroupedCategories(categories: Category[]) {
  const mainCategories = categories
    .filter((c) => c.parent_id === null)
    .sort((a, b) => a.name.localeCompare(b.name))

  const subsByParent = new Map<string, Category[]>()
  categories
    .filter((c) => c.parent_id !== null)
    .forEach((c) => {
      const subs = subsByParent.get(c.parent_id!) ?? []
      subs.push(c)
      subsByParent.set(c.parent_id!, subs)
    })

  // Sort subcategories alphabetically within each parent
  subsByParent.forEach((subs) => subs.sort((a, b) => a.name.localeCompare(b.name)))

  return { mainCategories, subsByParent }
}

// ── Action button styles ──────────────────────────────────────────────────────

const actionBtn =
  'text-xs font-medium text-zinc-500 hover:text-zinc-800 transition-colors px-1 py-0.5'
const actionBtnDanger =
  'text-xs font-medium text-red-400 hover:text-red-600 transition-colors px-1 py-0.5'

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [categories, setCategories]   = useState<Category[]>([])
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [modal, setModal]             = useState<ModalState | null>(null)

  function load() {
    setLoading(true)
    setLoadError(null)
    listCategories({ includeInactive: true })
      .then(setCategories)
      .catch(() => setLoadError('No se pudieron cargar las categorías.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function closeModal() {
    setModal(null)
  }

  function handleSaved() {
    setModal(null)
    load()
  }

  const { mainCategories, subsByParent } = buildGroupedCategories(categories)
  const totalMain = mainCategories.length
  const totalSub  = categories.filter((c) => c.parent_id !== null).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Categorías"
        description={`${totalMain} categoría${totalMain !== 1 ? 's' : ''} · ${totalSub} subcategoría${totalSub !== 1 ? 's' : ''}`}
        actions={
          <Button size="sm" onClick={() => setModal({ type: 'create-main' })}>
            + Nueva categoría
          </Button>
        }
      />

      <Card padding={false}>
        {loadError ? (
          <p className="px-6 py-12 text-center text-sm text-red-500">{loadError}</p>
        ) : loading ? (
          <p className="px-6 py-12 text-center text-sm text-zinc-400">Cargando categorías…</p>
        ) : mainCategories.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-sm text-zinc-400">No hay categorías. Crea la primera.</p>
            <Button size="sm" onClick={() => setModal({ type: 'create-main' })}>
              + Nueva categoría
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3 w-full">Nombre</th>
                  <th className="px-4 py-3 whitespace-nowrap">Subcategorías</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {mainCategories.map((cat) => {
                  const subs       = subsByParent.get(cat.id) ?? []
                  const isExpanded = expandedIds.has(cat.id)

                  return [
                    // ── Main category row ──────────────────────────────────
                    <tr
                      key={cat.id}
                      className="border-b border-zinc-100 hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleExpand(cat.id)}
                          className="flex items-center gap-2 font-medium text-zinc-900 hover:text-zinc-700 transition-colors"
                          disabled={subs.length === 0}
                        >
                          <span
                            className={[
                              'text-xs text-zinc-400 transition-transform select-none',
                              subs.length === 0 ? 'opacity-0' : '',
                              isExpanded ? 'rotate-90' : '',
                            ].join(' ')}
                          >
                            ▶
                          </span>
                          {cat.name}
                        </button>
                      </td>

                      <td className="px-4 py-3">
                        {subs.length > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                            {subs.length}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-300">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          label={cat.is_active ? 'Activa' : 'Inactiva'}
                          variant={cat.is_active ? 'success' : 'default'}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className={actionBtn}
                            onClick={() => setModal({ type: 'create-sub', parent: cat })}
                          >
                            + Subcategoría
                          </button>
                          <span className="text-zinc-200">|</span>
                          <button
                            type="button"
                            className={actionBtn}
                            onClick={() => setModal({ type: 'edit-main', category: cat })}
                          >
                            Editar
                          </button>
                          <span className="text-zinc-200">|</span>
                          <button
                            type="button"
                            className={actionBtnDanger}
                            onClick={() =>
                              setModal({ type: 'delete', category: cat, subCount: subs.length })
                            }
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>,

                    // ── Subcategory rows (shown when expanded) ─────────────
                    ...(isExpanded
                      ? subs.map((sub, idx) => (
                          <tr
                            key={sub.id}
                            className={[
                              'bg-zinc-50/60 hover:bg-zinc-50',
                              idx < subs.length - 1 ? 'border-b border-zinc-100/80' : 'border-b border-zinc-100',
                            ].join(' ')}
                          >
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-0">
                                {/* Tree indent */}
                                <span className="ml-9 mr-2 text-xs text-zinc-300 select-none">
                                  {idx < subs.length - 1 ? '├' : '└'}
                                </span>
                                <span className="text-sm text-zinc-700">{sub.name}</span>
                              </div>
                            </td>

                            <td className="px-4 py-2.5">
                              <span className="text-xs text-zinc-300">—</span>
                            </td>

                            <td className="px-4 py-2.5">
                              <Badge
                                label={sub.is_active ? 'Activa' : 'Inactiva'}
                                variant={sub.is_active ? 'success' : 'default'}
                              />
                            </td>

                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  className={actionBtn}
                                  onClick={() =>
                                    setModal({ type: 'edit-sub', category: sub, parent: cat })
                                  }
                                >
                                  Editar
                                </button>
                                <span className="text-zinc-200">|</span>
                                <button
                                  type="button"
                                  className={actionBtnDanger}
                                  onClick={() =>
                                    setModal({ type: 'delete', category: sub, subCount: 0 })
                                  }
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      : []),
                  ]
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {modal?.type === 'create-main' && (
        <CategoryFormModal
          mode="create"
          categoryType="main"
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {modal?.type === 'create-sub' && (
        <CategoryFormModal
          mode="create"
          categoryType="sub"
          parent={modal.parent}
          onClose={closeModal}
          onSaved={() => {
            handleSaved()
            // Keep parent expanded so user sees the new subcategory
            setExpandedIds((prev) => new Set(prev).add(modal.parent.id))
          }}
        />
      )}

      {modal?.type === 'edit-main' && (
        <CategoryFormModal
          mode="edit"
          categoryType="main"
          initial={modal.category}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {modal?.type === 'edit-sub' && (
        <CategoryFormModal
          mode="edit"
          categoryType="sub"
          parent={modal.parent}
          initial={modal.category}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {modal?.type === 'delete' && (
        <ConfirmModal
          title={`Eliminar "${modal.category.name}"`}
          message={
            modal.subCount > 0 ? (
              <span>
                Esta categoría tiene{' '}
                <strong>{modal.subCount} subcategoría{modal.subCount !== 1 ? 's' : ''}</strong>.
                {' '}Al eliminarla, sus subcategorías también serán eliminadas.
                <br /><br />
                Esta acción no se puede deshacer.
              </span>
            ) : (
              'Esta acción no se puede deshacer.'
            )
          }
          confirmLabel="Eliminar"
          danger
          onConfirm={async () => {
            await deleteCategory(modal.category.id)
            load()
          }}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
