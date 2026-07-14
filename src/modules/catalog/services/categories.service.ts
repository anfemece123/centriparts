import { supabase } from '@/lib/supabase'
import { slugify } from '@/shared/utils/slugify'
import type { Category, CategoryTreeNode } from '@/types'

export async function listCategories(options?: { includeInactive?: boolean }): Promise<Category[]> {
  let query = supabase.from('categories').select('*').order('name', { ascending: true })
  if (!options?.includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Category[]
}

export interface CreateCategoryPayload {
  name: string
  description?: string | null
  parent_id?: string | null
}

export async function createCategory(payload: CreateCategoryPayload): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ ...payload, slug: slugify(payload.name) })
    .select()
    .single()
  if (error) throw error
  return data as Category
}

export interface UpdateCategoryPayload {
  name?: string
  description?: string | null
  parent_id?: string | null
  is_active?: boolean
}

export async function updateCategory(
  id: string,
  payload: UpdateCategoryPayload,
): Promise<Category> {
  const update = payload.name
    ? { ...payload, slug: slugify(payload.name) }
    : payload

  const { data, error } = await supabase
    .from('categories')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Category
}

/**
 * Assigns a product to a category.
 * If isPrimary is true, any existing primary is replaced atomically:
 * the old primary is demoted, then the new one is upserted.
 */
export async function assignProductToCategory(
  productId: string,
  categoryId: string,
  isPrimary: boolean,
): Promise<void> {
  if (isPrimary) {
    // Demote the current primary (if any) before setting the new one
    await supabase
      .from('product_categories')
      .update({ is_primary: false })
      .eq('product_id', productId)
      .eq('is_primary', true)
  }

  const { error } = await supabase
    .from('product_categories')
    .upsert({ product_id: productId, category_id: categoryId, is_primary: isPrimary })
  if (error) throw error
}

export async function removeProductFromCategory(
  productId: string,
  categoryId: string,
): Promise<void> {
  const { error } = await supabase
    .from('product_categories')
    .delete()
    .eq('product_id', productId)
    .eq('category_id', categoryId)
  if (error) throw error
}

/**
 * Builds the real category tree, at any depth, from a flat list — used by
 * the visual search category selector. Root categories are the ones with
 * parent_id === null; every other category nests under its parent_id.
 * Guards against cycles so a corrupted parent_id chain can never loop.
 */
export function buildCategoryTree(categories: Category[]): CategoryTreeNode[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const childrenByParent = new Map<string, Category[]>()

  for (const category of categories) {
    if (category.parent_id === null) continue
    const siblings = childrenByParent.get(category.parent_id) ?? []
    siblings.push(category)
    childrenByParent.set(category.parent_id, siblings)
  }
  childrenByParent.forEach((siblings) => siblings.sort((a, b) => a.name.localeCompare(b.name)))

  function buildNode(category: Category, depth: number, visited: Set<string>): CategoryTreeNode {
    const children = visited.has(category.id)
      ? []
      : (childrenByParent.get(category.id) ?? []).map((child) =>
          buildNode(child, depth + 1, new Set(visited).add(category.id)),
        )
    return { id: category.id, name: category.name, depth, children }
  }

  return categories
    .filter((c) => c.parent_id === null || !byId.has(c.parent_id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => buildNode(c, 0, new Set()))
}

/** Flattens a category tree into a depth-ordered list, for rendering a <select>. */
export function flattenCategoryTree(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  const result: CategoryTreeNode[] = []
  for (const node of nodes) {
    result.push(node)
    result.push(...flattenCategoryTree(node.children))
  }
  return result
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
  if (error) throw error
}
