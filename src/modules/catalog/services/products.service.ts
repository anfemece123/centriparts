import { supabase } from '@/lib/supabase'
import type {
  Product,
  ProductListItem,
  ProductSearchSuggestion,
  ProductStatus,
  ProductWithRelations,
  PublicProductListItem,
} from '@/types'

function safeSearchTerm(value: string): string {
  return value.trim().replace(/[,()%]/g, ' ').replace(/\s+/g, ' ')
}

export async function searchProductSuggestions(
  search: string,
  options: { publicOnly?: boolean; limit?: number } = {},
): Promise<ProductSearchSuggestion[]> {
  const term = safeSearchTerm(search)
  if (term.length < 2) return []

  let query = supabase
    .from('products')
    .select(`
      id, ci, base_name, display_name, reference,
      images:product_images ( storage_path, alt_text, is_primary, display_order )
    `)
    .or(
      `base_name.ilike.%${term}%,display_name.ilike.%${term}%,ci.ilike.%${term}%,reference.ilike.%${term}%`,
    )
    .order('base_name', { ascending: true })
    .limit(Math.min(Math.max(options.limit ?? 6, 1), 10))

  if (options.publicOnly) query = query.eq('status', 'published')

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as ProductSearchSuggestion[]
}

export interface ListProductsParams {
  status?: ProductStatus
  search?: string
  typeId?: string
  brandId?: string
  categoryId?: string
  subcategoryId?: string
  page?: number
  pageSize?: number
}

export async function listProducts(params: ListProductsParams = {}): Promise<{
  data: ProductListItem[]
  count: number
}> {
  const {
    status,
    search,
    typeId,
    brandId,
    categoryId,
    subcategoryId,
    page = 1,
    pageSize = 50,
  } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const effectiveCategoryId = subcategoryId || categoryId
  const categoryFilterJoin = effectiveCategoryId
    ? ', category_filter:product_categories!inner ( category_id )'
    : ''

  let query = supabase
    .from('products')
    .select(
      `
      id, ci, base_name, display_name, reference, status, stock, sale_price, created_at,
      type:type_id ( id, name ),
      brand:brand_id ( id, name ),
      categories:product_categories (
        is_primary,
        category:category_id ( id, name, parent_id )
      ),
      compatibility:product_compatibility (
        id, year_from, year_to, is_verified,
        vehicle_brand:vehicle_brand_id ( id, name ),
        vehicle_model:vehicle_model_id ( id, name )
      ),
      images:product_images ( storage_path, alt_text, is_primary, display_order )
      ${categoryFilterJoin}
      `,
      { count: 'exact' },
    )
    .range(from, to)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (typeId) query = query.eq('type_id', typeId)
  if (brandId) query = query.eq('brand_id', brandId)
  if (effectiveCategoryId) {
    query = query.eq('category_filter.category_id', effectiveCategoryId)
  }
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
  typeId?: string
  brandId?: string
  categoryId?: string
  subcategoryId?: string
  sort?: 'newest' | 'price-asc' | 'price-desc'
  page?: number
  pageSize?: number
} = {}): Promise<{ data: PublicProductListItem[]; count: number }> {
  const {
    search,
    typeId,
    brandId,
    categoryId,
    subcategoryId,
    sort = 'newest',
    page = 1,
    pageSize = 24,
  } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const effectiveCategoryId = subcategoryId || categoryId

  // When filtering by category, add !inner join so only products in that category are returned.
  // Without a category filter, the join is omitted so products without categories are included.
  const categoryJoin = effectiveCategoryId
    ? `, public_category_filter:product_categories!inner ( category_id )`
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

  if (search) {
    query = query.or(
      `base_name.ilike.%${search}%,display_name.ilike.%${search}%,reference.ilike.%${search}%,ci.ilike.%${search}%`,
    )
  }
  if (typeId) {
    query = query.eq('type_id', typeId)
  }
  if (brandId) {
    query = query.eq('brand_id', brandId)
  }
  if (effectiveCategoryId) {
    query = query.eq('public_category_filter.category_id', effectiveCategoryId)
  }

  if (sort === 'price-asc') {
    query = query.order('sale_price', { ascending: true })
  } else if (sort === 'price-desc') {
    query = query.order('sale_price', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  query = query.range(from, to)

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
  base_name?: string
  display_name?: string | null
  reference?: string | null
  description?: string | null
  sale_price?: number
  cost_price?: number
  stock?: number
  type_id?: string | null
  brand_id?: string | null
  status?: ProductStatus
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
