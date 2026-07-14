export type ProductImageFitMode = 'crop' | 'contain'

export interface ImageOffset {
  x: number
  y: number
}

interface ImageLayoutParams {
  naturalWidth: number
  naturalHeight: number
  cropSize: number
  zoom: number
  fitMode: ProductImageFitMode
}

export interface ImageLayout {
  width: number
  height: number
  maxOffsetX: number
  maxOffsetY: number
}

export const PRODUCT_IMAGE_OUTPUT_SIZE = 1200
export const PRODUCT_IMAGE_MAX_FILE_SIZE = 25 * 1024 * 1024
export const PRODUCT_IMAGE_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export function calculateImageLayout({
  naturalWidth,
  naturalHeight,
  cropSize,
  zoom,
  fitMode,
}: ImageLayoutParams): ImageLayout {
  if (naturalWidth <= 0 || naturalHeight <= 0 || cropSize <= 0) {
    return { width: 0, height: 0, maxOffsetX: 0, maxOffsetY: 0 }
  }

  const scaleX = cropSize / naturalWidth
  const scaleY = cropSize / naturalHeight
  const baseScale = fitMode === 'crop'
    ? Math.max(scaleX, scaleY)
    : Math.min(scaleX, scaleY)
  const scale = baseScale * Math.max(1, zoom)
  const width = naturalWidth * scale
  const height = naturalHeight * scale

  return {
    width,
    height,
    maxOffsetX: Math.max(0, (width - cropSize) / 2),
    maxOffsetY: Math.max(0, (height - cropSize) / 2),
  }
}

export function clampImageOffset(offset: ImageOffset, layout: ImageLayout): ImageOffset {
  return {
    x: Math.max(-layout.maxOffsetX, Math.min(layout.maxOffsetX, offset.x)),
    y: Math.max(-layout.maxOffsetY, Math.min(layout.maxOffsetY, offset.y)),
  }
}

function optimizedFilename(originalName: string): string {
  const baseName = originalName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

  return `${baseName || 'producto'}-optimizada.jpg`
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('No se pudo generar la imagen optimizada.'))
      },
      'image/jpeg',
      0.9,
    )
  })
}

export async function createOptimizedProductImage({
  image,
  originalFile,
  cropSize,
  zoom,
  offset,
  fitMode,
}: {
  image: HTMLImageElement
  originalFile: File
  cropSize: number
  zoom: number
  offset: ImageOffset
  fitMode: ProductImageFitMode
}): Promise<File> {
  if (!image.naturalWidth || !image.naturalHeight || cropSize <= 0) {
    throw new Error('La imagen todavía no está lista para procesarse.')
  }

  const layout = calculateImageLayout({
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    cropSize,
    zoom,
    fitMode,
  })
  const safeOffset = clampImageOffset(offset, layout)
  const outputScale = PRODUCT_IMAGE_OUTPUT_SIZE / cropSize

  const canvas = document.createElement('canvas')
  canvas.width = PRODUCT_IMAGE_OUTPUT_SIZE
  canvas.height = PRODUCT_IMAGE_OUTPUT_SIZE

  const context = canvas.getContext('2d')
  if (!context) throw new Error('El navegador no permite procesar esta imagen.')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  const drawWidth = layout.width * outputScale
  const drawHeight = layout.height * outputScale
  const drawX = (PRODUCT_IMAGE_OUTPUT_SIZE - drawWidth) / 2 + safeOffset.x * outputScale
  const drawY = (PRODUCT_IMAGE_OUTPUT_SIZE - drawHeight) / 2 + safeOffset.y * outputScale

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight)

  const blob = await canvasToBlob(canvas)
  return new File([blob], optimizedFilename(originalFile.name), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

export function validateProductImageFile(file: File): string | null {
  if (!PRODUCT_IMAGE_ACCEPTED_TYPES.includes(file.type as (typeof PRODUCT_IMAGE_ACCEPTED_TYPES)[number])) {
    return 'Formato no compatible. Utilice una imagen JPG, PNG o WebP.'
  }
  if (file.size > PRODUCT_IMAGE_MAX_FILE_SIZE) {
    return 'La imagen supera el límite de 25 MB.'
  }
  return null
}
