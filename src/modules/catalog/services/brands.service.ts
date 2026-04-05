import { supabase } from '@/lib/supabase'
import type { ProductBrand, ProductType, VehicleBrand, VehicleModel } from '@/types'

export async function listProductTypes(): Promise<ProductType[]> {
  const { data, error } = await supabase
    .from('product_types')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProductType[]
}

export async function listProductBrands(): Promise<ProductBrand[]> {
  const { data, error } = await supabase
    .from('product_brands')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as ProductBrand[]
}

export async function listVehicleBrands(): Promise<VehicleBrand[]> {
  const { data, error } = await supabase
    .from('vehicle_brands')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as VehicleBrand[]
}

export async function listVehicleModels(vehicleBrandId?: string): Promise<VehicleModel[]> {
  let query = supabase.from('vehicle_models').select('*').order('name', { ascending: true })
  if (vehicleBrandId) query = query.eq('vehicle_brand_id', vehicleBrandId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as VehicleModel[]
}
