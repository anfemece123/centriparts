import type { CategoryScope } from './types.ts'

export type CategoryScopeErrorCode = 'invalid_category' | 'inactive_category'

export class CategoryScopeError extends Error {
  code: CategoryScopeErrorCode
  constructor(code: CategoryScopeErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export interface CategoryScopePort {
  getCategory(id: string): Promise<{ id: string; is_active: boolean } | null>
  /** Returns the given id plus every active descendant, at any depth. */
  getDescendantIds(id: string): Promise<string[]>
}

/**
 * Resolves the "allowed category ids" scope for a search.
 * - null/empty categoryId => global search (isGlobalSearch = true).
 * - Unknown category id   => CategoryScopeError('invalid_category').
 * - Inactive category     => CategoryScopeError('inactive_category').
 * - Otherwise             => the category plus all active descendants,
 *                            never the parent, never sibling categories.
 */
export async function resolveCategoryScope(
  categoryId: string | null,
  port: CategoryScopePort,
): Promise<CategoryScope> {
  if (categoryId === null || categoryId === '') {
    return { selectedCategoryId: null, includedCategoryIds: [], isGlobalSearch: true }
  }

  const category = await port.getCategory(categoryId)
  if (!category) {
    throw new CategoryScopeError('invalid_category', 'La categoría seleccionada no existe.')
  }
  if (!category.is_active) {
    throw new CategoryScopeError('inactive_category', 'La categoría seleccionada no está disponible.')
  }

  const descendantIds = await port.getDescendantIds(categoryId)
  const includedCategoryIds = descendantIds.includes(categoryId)
    ? descendantIds
    : [categoryId, ...descendantIds]

  return { selectedCategoryId: categoryId, includedCategoryIds, isGlobalSearch: false }
}
