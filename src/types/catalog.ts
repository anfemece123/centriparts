export type ProductStatus = 'draft' | 'ready' | 'published' | 'archived'
export type ParseStatus = 'auto' | 'partial' | 'manual'

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  parent_id: string | null
  is_active: boolean
  created_at: string
}

export interface ProductType {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface ProductBrand {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface VehicleBrand {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface VehicleModel {
  id: string
  vehicle_brand_id: string
  name: string
  slug: string
  created_at: string
}

export interface Product {
  id: string
  ci: string
  base_name: string
  display_name: string | null
  slug: string
  reference: string | null
  description: string | null
  sale_price: number
  cost_price: number
  stock: number
  type_id: string | null
  brand_id: string | null
  raw_compatibility: string | null
  status: ProductStatus
  created_at: string
  updated_at: string
}

export interface ProductCategory {
  product_id: string
  category_id: string
  is_primary: boolean
}

export interface ProductCompatibility {
  id: string
  product_id: string
  vehicle_brand_id: string | null
  vehicle_model_id: string | null
  year_from: number | null
  year_to: number | null
  notes: string | null
  raw_source_fragment: string | null
  parse_status: ParseStatus
  is_verified: boolean
  created_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  storage_path: string
  alt_text: string | null
  display_order: number
  is_primary: boolean
  created_at: string
}

// Joined shapes used in admin views
export interface ProductWithRelations extends Product {
  type: ProductType | null
  brand: ProductBrand | null
  categories: Array<Category & { is_primary: boolean }>
  compatibility: Array<ProductCompatibility & { vehicle_brand: VehicleBrand | null; vehicle_model: VehicleModel | null }>
  images: ProductImage[]
}

export interface ProductListItem {
  id: string
  ci: string
  base_name: string
  display_name: string | null
  reference: string | null
  status: ProductStatus
  stock: number
  sale_price: number
  type: Pick<ProductType, 'id' | 'name'> | null
  brand: Pick<ProductBrand, 'id' | 'name'> | null
  primary_category: Pick<Category, 'id' | 'name'> | null
  created_at: string
}

export interface PublicProductListItem {
  id: string
  base_name: string
  display_name: string | null
  sale_price: number
  description: string | null
  brand: Pick<ProductBrand, 'id' | 'name'> | null
  images: Pick<ProductImage, 'storage_path' | 'alt_text' | 'is_primary' | 'display_order'>[]
}
