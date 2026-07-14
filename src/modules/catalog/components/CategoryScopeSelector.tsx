import { buildCategoryTree, flattenCategoryTree } from '@/modules/catalog/services/categories.service'
import type { Category } from '@/types'

interface Props {
  categories: Category[]
  value: string
  onChange: (categoryId: string) => void
  disabled?: boolean
}

const SELECT_CLASS =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 disabled:cursor-not-allowed disabled:opacity-50'

export default function CategoryScopeSelector({ categories, value, onChange, disabled }: Props) {
  const flat = flattenCategoryTree(buildCategoryTree(categories))

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="visual-search-category" className="text-sm font-medium text-zinc-700">
        Categoría de búsqueda
      </label>
      <select
        id="visual-search-category"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={SELECT_CLASS}
      >
        <option value="">Todas las categorías</option>
        {flat.map((node) => (
          <option key={node.id} value={node.id}>
            {'  '.repeat(node.depth)}
            {node.depth > 0 ? '– ' : ''}
            {node.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-zinc-400">
        Selecciona una categoría para obtener resultados más precisos y rápidos. Si eliges
        “Todas las categorías”, buscaremos en todo el catálogo.
      </p>
    </div>
  )
}
