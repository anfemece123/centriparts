import { useRef, useState } from 'react'
import { Button, Badge } from '@/shared/components/ui'
import {
  uploadProductImage,
  deleteProductImage,
  setPrimaryImage,
  getPublicImageUrl,
} from '@/modules/catalog/services/product-images.service'
import type { ProductImage } from '@/types'

interface Props {
  productId: string
  images: ProductImage[]
  onRefresh: () => Promise<void>
}

export default function ProductImagesSection({ productId, images, onRefresh }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [busyImageId, setBusyImageId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so the same file can be re-uploaded if needed
    e.target.value = ''

    setUploading(true)
    setUploadError(null)

    try {
      await uploadProductImage(productId, file)
      await onRefresh()
    } catch {
      setUploadError('No se pudo subir la imagen. Intente de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(image: ProductImage) {
    setBusyImageId(image.id)
    setActionError(null)
    try {
      await deleteProductImage(image.id, image.storage_path)
      await onRefresh()
    } catch {
      setActionError('No se pudo eliminar la imagen.')
    } finally {
      setBusyImageId(null)
    }
  }

  async function handleSetPrimary(image: ProductImage) {
    if (image.is_primary) return
    setBusyImageId(image.id)
    setActionError(null)
    try {
      await setPrimaryImage(productId, image.id)
      await onRefresh()
    } catch {
      setActionError('No se pudo establecer la imagen principal.')
    } finally {
      setBusyImageId(null)
    }
  }

  const sorted = [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return a.display_order - b.display_order
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700">Imágenes</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            {images.length} imagen{images.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <Button
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? 'Subiendo…' : '+ Agregar imagen'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {uploadError && (
        <p className="text-sm text-red-500">{uploadError}</p>
      )}
      {actionError && (
        <p className="text-sm text-red-500">{actionError}</p>
      )}

      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">
          Sin imágenes. Agregue la primera imagen del producto.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {sorted.map((image) => {
            const isBusy = busyImageId === image.id
            const url = getPublicImageUrl(image.storage_path)

            return (
              <div
                key={image.id}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-zinc-100">
                  <img
                    src={url}
                    alt={image.alt_text ?? 'Imagen del producto'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {image.is_primary && (
                    <div className="absolute left-2 top-2">
                      <Badge label="Principal" variant="info" />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1 px-2 py-2">
                  {!image.is_primary ? (
                    <button
                      onClick={() => handleSetPrimary(image)}
                      disabled={isBusy}
                      className="text-xs text-zinc-500 hover:text-yellow-600 disabled:opacity-40 transition-colors"
                    >
                      Establecer principal
                    </button>
                  ) : (
                    <span className="text-xs text-zinc-300">Principal</span>
                  )}
                  <button
                    onClick={() => handleDelete(image)}
                    disabled={isBusy}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                  >
                    {isBusy ? '…' : 'Eliminar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
