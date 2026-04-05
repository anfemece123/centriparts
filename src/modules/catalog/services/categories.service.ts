import { supabase } from '@/lib/supabase'
import { slugify } from '@/shared/utils/slugify'
import type { Category } from '@/types'

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
