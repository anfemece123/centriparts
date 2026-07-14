import { describe, expect, it } from 'vitest'
import { resolveCategoryScope, CategoryScopeError, type CategoryScopePort } from './categoryScope.ts'

// A small fake category tree, deep enough to exercise >2 levels:
// Encendido (root)
//  └── Bobinas
//       ├── Bobinas lápiz
//       └── Bobinas tipo bloque
//  └── Bujías (sibling of Bobinas)
function makePort(overrides: Partial<CategoryScopePort> = {}): CategoryScopePort {
  const categories: Record<string, { id: string; is_active: boolean }> = {
    encendido: { id: 'encendido', is_active: true },
    bobinas: { id: 'bobinas', is_active: true },
    'bobinas-lapiz': { id: 'bobinas-lapiz', is_active: true },
    'bobinas-bloque': { id: 'bobinas-bloque', is_active: true },
    bujias: { id: 'bujias', is_active: true },
    inactiva: { id: 'inactiva', is_active: false },
  }

  const descendants: Record<string, string[]> = {
    encendido: ['encendido', 'bobinas', 'bobinas-lapiz', 'bobinas-bloque', 'bujias'],
    bobinas: ['bobinas', 'bobinas-lapiz', 'bobinas-bloque'],
    'bobinas-lapiz': ['bobinas-lapiz'],
  }

  return {
    getCategory: async (id) => categories[id] ?? null,
    getDescendantIds: async (id) => descendants[id] ?? [id],
    ...overrides,
  }
}

describe('resolveCategoryScope', () => {
  it('performs a global search when categoryId is null', async () => {
    const scope = await resolveCategoryScope(null, makePort())
    expect(scope).toEqual({ selectedCategoryId: null, includedCategoryIds: [], isGlobalSearch: true })
  })

  it('performs a global search when categoryId is an empty string', async () => {
    const scope = await resolveCategoryScope('', makePort())
    expect(scope.isGlobalSearch).toBe(true)
  })

  it('restricts the search to the selected category plus its descendants', async () => {
    const scope = await resolveCategoryScope('bobinas', makePort())
    expect(scope.isGlobalSearch).toBe(false)
    expect(scope.selectedCategoryId).toBe('bobinas')
    expect(new Set(scope.includedCategoryIds)).toEqual(new Set(['bobinas', 'bobinas-lapiz', 'bobinas-bloque']))
  })

  it('never includes the parent when a subcategory is selected', async () => {
    const scope = await resolveCategoryScope('bobinas', makePort())
    expect(scope.includedCategoryIds).not.toContain('encendido')
  })

  it('never includes sibling categories', async () => {
    const scope = await resolveCategoryScope('bobinas', makePort())
    expect(scope.includedCategoryIds).not.toContain('bujias')
  })

  it('selecting a leaf subcategory does not pull in the whole parent tree', async () => {
    const scope = await resolveCategoryScope('bobinas-lapiz', makePort())
    expect(scope.includedCategoryIds).toEqual(['bobinas-lapiz'])
  })

  it('supports depth greater than two levels', async () => {
    const scope = await resolveCategoryScope('encendido', makePort())
    expect(scope.includedCategoryIds).toHaveLength(5)
    expect(scope.includedCategoryIds).toContain('bobinas-lapiz')
  })

  it('rejects an unknown category id', async () => {
    await expect(resolveCategoryScope('does-not-exist', makePort())).rejects.toThrow(CategoryScopeError)
  })

  it('rejects an inactive category', async () => {
    await expect(resolveCategoryScope('inactiva', makePort())).rejects.toMatchObject({ code: 'inactive_category' })
  })
})
