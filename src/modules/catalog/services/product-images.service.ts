import { supabase } from '@/lib/supabase'
import type { ProductImage } from '@/types'

const BUCKET = 'product-images'

function getExtension(file: File): string {
  const parts = file.name.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'jpg'
}

export function getPublicImageUrl(storagePath: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`
}

export async function uploadProductImage(
  productId: string,
  file: File,
): Promise<ProductImage> {
  const ext = getExtension(file)
  const storagePath = `${productId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { cacheControl: '3600', upsert: false })

  if (uploadError) throw uploadError

  const { data, error: insertError } = await supabase
    .from('product_images')
    .insert({
      product_id: productId,
      storage_path: storagePath,
      display_order: 0,
      is_primary: false,
    })
    .select()
    .single()

  if (insertError) {
    // Clean up the uploaded file if the DB insert fails
    await supabase.storage.from(BUCKET).remove([storagePath])
    throw insertError
  }

  return data as ProductImage
}

export async function deleteProductImage(
  imageId: string,
  storagePath: string,
): Promise<void> {
  const { error: dbError } = await supabase
    .from('product_images')
    .delete()
    .eq('id', imageId)

  if (dbError) throw dbError

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath])

  if (storageError) throw storageError
}

export async function setPrimaryImage(
  productId: string,
  imageId: string,
): Promise<void> {
  // Clear current primary for this product
  const { error: clearError } = await supabase
    .from('product_images')
    .update({ is_primary: false })
    .eq('product_id', productId)
    .eq('is_primary', true)

  if (clearError) throw clearError

  // Set new primary
  const { error: setError } = await supabase
    .from('product_images')
    .update({ is_primary: true })
    .eq('id', imageId)

  if (setError) throw setError
}
