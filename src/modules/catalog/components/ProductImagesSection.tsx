import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Button, Badge } from '@/shared/components/ui'
import {
  uploadProductImage,
  deleteProductImage,
  setPrimaryImage,
  getPublicImageUrl,
} from '@/modules/catalog/services/product-images.service'
import { getImageAnalysisSummaries } from '@/modules/catalog/services/visual-search-stats.service'
import { indexProductImageById } from '@/modules/catalog/services/visual-search.service'
import ProductImageEditorModal from '@/modules/catalog/components/ProductImageEditorModal'
import { validateProductImageFile } from '@/modules/catalog/utils/product-image-processing'
import type { ProductImage, ProductImageAnalysisSummary } from '@/types'

interface Props {
  productId: string
  images: ProductImage[]
  onRefresh: () => Promise<void>
}

const STATUS_BADGE: Record<ProductImageAnalysisSummary['status'], { label: string; variant: 'default' | 'info' | 'success' | 'danger' | 'warning' }> = {
  pending: { label: 'Pendiente', variant: 'default' },
  processing: { label: 'Analizando…', variant: 'info' },
  completed: { label: 'Analizada', variant: 'success' },
  failed: { label: 'Error', variant: 'danger' },
}

interface PendingImage {
  file: File
  previewUrl: string
}

export default function ProductImagesSection({ productId, images, onRefresh }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)

  const [busyImageId, setBusyImageId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [analysisByImageId, setAnalysisByImageId] = useState<Map<string, ProductImageAnalysisSummary>>(new Map())
  const [expandedImageId, setExpandedImageId] = useState<string | null>(null)
  const [analyzingImageId, setAnalyzingImageId] = useState<string | null>(null)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  useEffect(() => {
    if (images.length === 0) return
    getImageAnalysisSummaries(images.map((img) => img.id))
      .then(setAnalysisByImageId)
      .catch(() => {})
    // Re-check whenever the image list changes (new upload, delete, etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.map((img) => img.id).join(',')])

  useEffect(() => {
    const previewUrl = pendingImage?.previewUrl
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [pendingImage])

  async function handleAnalyze(imageId: string) {
    setAnalyzingImageId(imageId)
    setAnalyzeError(null)
    try {
      await indexProductImageById(imageId)
      const refreshed = await getImageAnalysisSummaries(images.map((img) => img.id))
      setAnalysisByImageId(refreshed)
    } catch {
      setAnalyzeError('No se pudo analizar la imagen. Intente de nuevo.')
    } finally {
      setAnalyzingImageId(null)
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''
    setUploadError(null)

    const validationError = validateProductImageFile(file)
    if (validationError) {
      setUploadError(validationError)
      return
    }

    setPendingImage({ file, previewUrl: URL.createObjectURL(file) })
  }

  async function handleEditedImage(optimizedFile: File) {
    setUploading(true)
    setUploadError(null)
    try {
      await uploadProductImage(productId, optimizedFile)
      await onRefresh()
      setPendingImage(null)
    } catch {
      const message = 'No se pudo subir la imagen optimizada. Intente de nuevo.'
      setUploadError(message)
      throw new Error(message)
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
            {images.length} imagen{images.length !== 1 ? 'es' : ''} · recorte y optimización incluidos
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
          accept="image/jpeg,image/png,image/webp"
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
      {analyzeError && (
        <p className="text-sm text-red-500">{analyzeError}</p>
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
            const analysis = analysisByImageId.get(image.id)
            const isAnalyzing = analyzingImageId === image.id
            const isExpanded = expandedImageId === image.id
            const statusInfo = analysis ? STATUS_BADGE[analysis.status] : null
            const actionLabel = !analysis || analysis.status === 'pending'
              ? 'Analizar'
              : analysis.status === 'failed'
                ? 'Reintentar'
                : 'Reanalizar'

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
                  {statusInfo && (
                    <div className="absolute right-2 top-2">
                      <Badge label={statusInfo.label} variant={statusInfo.variant} />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 px-2 py-2">
                  <div className="flex items-center justify-between gap-1">
                    {!image.is_primary ? (
                      <button
                        onClick={() => handleSetPrimary(image)}
                        disabled={isBusy}
                        className="rounded-full px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-yellow-50 hover:text-yellow-600 disabled:opacity-40"
                      >
                        Establecer principal
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-300">Principal</span>
                    )}
                    <button
                      onClick={() => handleDelete(image)}
                      disabled={isBusy}
                      className="rounded-full px-2 py-1 text-xs text-red-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      {isBusy ? '…' : 'Eliminar'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <button
                      onClick={() => handleAnalyze(image.id)}
                      disabled={isAnalyzing}
                      className="rounded-full px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-yellow-50 hover:text-yellow-600 disabled:opacity-40"
                    >
                      {isAnalyzing ? 'Analizando…' : actionLabel}
                    </button>
                    {analysis?.status === 'completed' && (
                      <button
                        onClick={() => setExpandedImageId(isExpanded ? null : image.id)}
                        className="rounded-full px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                      >
                        {isExpanded ? 'Ocultar datos' : 'Ver datos detectados'}
                      </button>
                    )}
                  </div>

                  {isExpanded && analysis && (
                    <div className="rounded-md bg-white border border-zinc-100 px-2 py-2 text-[11px] text-zinc-600">
                      <p>Confianza: {analysis.analysisConfidence !== null ? `${Math.round(analysis.analysisConfidence * 100)}%` : '—'}</p>
                      <p>Referencias: {analysis.detectedReferenceCodes.length > 0 ? analysis.detectedReferenceCodes.join(', ') : '—'}</p>
                      <p>OEM: {analysis.detectedOemCodes.length > 0 ? analysis.detectedOemCodes.join(', ') : '—'}</p>
                    </div>
                  )}

                  {analysis?.status === 'failed' && analysis.errorMessage && (
                    <p className="text-[11px] text-red-500">{analysis.errorMessage}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pendingImage && (
        <ProductImageEditorModal
          file={pendingImage.file}
          previewUrl={pendingImage.previewUrl}
          onClose={() => { if (!uploading) setPendingImage(null) }}
          onConfirm={handleEditedImage}
        />
      )}
    </div>
  )
}
