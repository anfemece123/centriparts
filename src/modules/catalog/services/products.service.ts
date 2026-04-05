import { supabase } from '@/lib/supabase'
import type { Product, ProductStatus, ProductWithRelations, ProductListItem, PublicProductListItem } from '@/types'

export interface ListProductsParams {
  status?: ProductStatus
  search?: string
  typeId?: string
  brandId?: string
  page?: number
  pageSize?: number
}

export async function listProducts(params: ListProductsParams = {}): Promise<{
  data: ProductListItem[]
  count: number
}> {
  const { status, search, typeId, brandId, page = 1, pageSize = 50 } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('products')
    .select(
      `
      id, ci, base_name, display_name, reference, status, stock, sale_price, created_at,
      type:type_id ( id, name ),
      brand:brand_id ( id, name )
      `,
      { count: 'exact' },
    )
    .range(from, to)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (typeId) query = query.eq('type_id', typeId)
  if (brandId) query = query.eq('brand_id', brandId)
  if (search) {
    query = query.or(
      `base_name.ilike.%${search}%,display_name.ilike.%${search}%,ci.ilike.%${search}%,reference.ilike.%${search}%`,
    )
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as unknown as ProductListItem[], count: count ?? 0 }
}

export async function listPublicProducts(params: {
  search?: string
  brandId?: string
  categoryId?: string
  page?: number
  pageSize?: number
} = {}): Promise<{ data: PublicProductListItem[]; count: number }> {
  const { search, brandId, categoryId, page = 1, pageSize = 24 } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // When filtering by category, add !inner join so only products in that category are returned.
  // Without a category filter, the join is omitted so products without categories are included.
  const categoryJoin = categoryId
    ? `, product_categories!inner ( category_id )`
    : ''

  let query = supabase
    .from('products')
    .select(
      `
      id, base_name, display_name, sale_price, description,
      brand:brand_id ( id, name ),
      images:product_images ( storage_path, alt_text, is_primary, display_order )
      ${categoryJoin}
      `,
      { count: 'exact' },
    )
    .eq('status', 'published')
    .range(from, to)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.or(`base_name.ilike.%${search}%,display_name.ilike.%${search}%`)
  }
  if (brandId) {
    query = query.eq('brand_id', brandId)
  }
  if (categoryId) {
    query = query.eq('product_categories.category_id', categoryId)
  }

  const { data, error, count } = await query
  if (error) throw error
  return { data: (data ?? []) as unknown as PublicProductListItem[], count: count ?? 0 }
}

export async function getProductById(id: string): Promise<ProductWithRelations | null> {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      type:type_id ( * ),
      brand:brand_id ( * ),
      categories:product_categories ( is_primary, category:category_id ( * ) ),
      compatibility:product_compatibility (
        *,
        vehicle_brand:vehicle_brand_id ( * ),
        vehicle_model:vehicle_model_id ( * )
      ),
      images:product_images ( * )
      `,
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as unknown as ProductWithRelations | null
}

export async function updateProductStatus(id: string, status: ProductStatus): Promise<void> {
  const { error } = await supabase.from('products').update({ status }).eq('id', id)
  if (error) throw error
}

export interface UpdateProductDetailsPayload {
  display_name?: string | null
  reference?: string | null
  description?: string | null
  sale_price?: number
  stock?: number
  type_id?: string | null
  brand_id?: string | null
}

export async function updateProductDetails(
  id: string,
  payload: UpdateProductDetailsPayload,
): Promise<Pick<Product, 'id' | 'updated_at'>> {
  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', id)
    .select('id, updated_at')
    .single()
  if (error) throw error
  return data as unknown as Pick<Product, 'id' | 'updated_at'>
}
