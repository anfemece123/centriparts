import { supabase } from '@/lib/supabase'
import type { ProductCompatibility } from '@/types'

export interface CompatibilityPayload {
  vehicle_brand_id: string | null
  vehicle_model_id: string | null
  year_from: number | null
  year_to: number | null
  notes: string | null
}

/**
 * Inserts a new compatibility row.
 * Manually added rows are always marked as parse_status='manual' and is_verified=true.
 */
export async function addCompatibilityRow(
  productId: string,
  payload: CompatibilityPayload,
): Promise<ProductCompatibility> {
  const { data, error } = await supabase
    .from('product_compatibility')
    .insert({
      product_id: productId,
      ...payload,
      parse_status: 'manual',
      is_verified: true,
    })
    .select()
    .single()
  if (error) throw error
  return data as ProductCompatibility
}

/**
 * Updates an existing compatibility row.
 * Any edited row becomes parse_status='manual' and is_verified=true.
 */
export async function updateCompatibilityRow(
  id: string,
  payload: CompatibilityPayload,
): Promise<ProductCompatibility> {
  const { data, error } = await supabase
    .from('product_compatibility')
    .update({
      ...payload,
      parse_status: 'manual',
      is_verified: true,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as ProductCompatibility
}

/**
 * Deletes a compatibility row permanently.
 */
export async function deleteCompatibilityRow(id: string): Promise<void> {
  const { error } = await supabase
    .from('product_compatibility')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/**
 * Marks a compatibility row as verified without changing other fields.
 * Useful for quickly confirming auto-parsed rows that look correct.
 */
export async function verifyCompatibilityRow(id: string): Promise<void> {
  const { error } = await supabase
    .from('product_compatibility')
    .update({ is_verified: true })
    .eq('id', id)
  if (error) throw error
}
