import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Button } from '@/shared/components/ui'
import {
  calculateImageLayout,
  clampImageOffset,
  createOptimizedProductImage,
  PRODUCT_IMAGE_OUTPUT_SIZE,
  type ImageOffset,
  type ProductImageFitMode,
} from '@/modules/catalog/utils/product-image-processing'

interface Props {
  file: File
  previewUrl: string
  onClose: () => void
  onConfirm: (optimizedFile: File) => Promise<void>
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function CropIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3v12a2 2 0 002 2h12M3 7h12a2 2 0 012 2v12" />
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-5 4 4 2-2 5 4" />
    </svg>
  )
}

export default function ProductImageEditorModal({ file, previewUrl, onClose, onConfirm }: Props) {
  const cropAreaRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const dragStartRef = useRef<{
    pointerId: number
    clientX: number
    clientY: number
    offset: ImageOffset
  } | null>(null)

  const [cropSize, setCropSize] = useState(0)
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })
  const [fitMode, setFitMode] = useState<ProductImageFitMode>('crop')
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState<ImageOffset>({ x: 0, y: 0 })
  const [processing, setProcessing] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)

  useEffect(() => {
    const cropArea = cropAreaRef.current
    if (!cropArea) return

    const observer = new ResizeObserver(([entry]) => {
      const nextSize = entry?.contentRect.width ?? 0
      if (nextSize > 0) setCropSize(nextSize)
    })
    observer.observe(cropArea)
    return () => observer.disconnect()
  }, [])

  const layout = calculateImageLayout({
    naturalWidth: naturalSize.width,
    naturalHeight: naturalSize.height,
    cropSize,
    zoom,
    fitMode,
  })

  function changeFitMode(nextMode: ProductImageFitMode) {
    setFitMode(nextMode)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setProcessError(null)
  }

  function changeZoom(nextZoom: number) {
    const nextLayout = calculateImageLayout({
      naturalWidth: naturalSize.width,
      naturalHeight: naturalSize.height,
      cropSize,
      zoom: nextZoom,
      fitMode,
    })
    setZoom(nextZoom)
    setOffset((currentOffset) => clampImageOffset(currentOffset, nextLayout))
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!naturalSize.width || processing) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      offset,
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const dragStart = dragStartRef.current
    if (!dragStart || dragStart.pointerId !== event.pointerId) return
    event.preventDefault()
    setOffset(clampImageOffset({
      x: dragStart.offset.x + event.clientX - dragStart.clientX,
      y: dragStart.offset.y + event.clientY - dragStart.clientY,
    }, layout))
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartRef.current?.pointerId !== event.pointerId) return
    dragStartRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  async function handleConfirm() {
    const image = imageRef.current
    if (!image || !cropSize) return

    setProcessing(true)
    setProcessError(null)
    try {
      const optimizedFile = await createOptimizedProductImage({
        image,
        originalFile: file,
        cropSize,
        zoom,
        offset,
        fitMode,
      })
      await onConfirm(optimizedFile)
    } catch (error) {
      setProcessError(
        error instanceof Error
          ? error.message
          : 'No se pudo procesar y subir la imagen. Intente de nuevo.',
      )
    } finally {
      setProcessing(false)
    }
  }

  const lowResolution = naturalSize.width > 0 && (
    naturalSize.width < PRODUCT_IMAGE_OUTPUT_SIZE ||
    naturalSize.height < PRODUCT_IMAGE_OUTPUT_SIZE
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-editor-title"
      onClick={() => { if (!processing) onClose() }}
    >
      <div
        className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700">
              <CropIcon />
            </span>
            <div className="min-w-0">
              <h2 id="image-editor-title" className="text-base font-semibold text-zinc-900">
                Preparar imagen del producto
              </h2>
              <p className="truncate text-xs text-zinc-400">
                {file.name} · {formatFileSize(file.size)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={processing}
            aria-label="Cerrar editor"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="grid flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)] lg:overflow-hidden">
          <div className="flex min-h-0 items-center justify-center bg-zinc-950 p-4 sm:p-7 lg:overflow-hidden">
            <div className="w-full max-w-[560px]">
              <div
                ref={cropAreaRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                className="relative aspect-square w-full cursor-grab touch-none select-none overflow-hidden bg-white shadow-2xl active:cursor-grabbing"
              >
                <img
                  ref={imageRef}
                  src={previewUrl}
                  alt="Vista previa para recortar"
                  draggable={false}
                  onLoad={(event) => {
                    setNaturalSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    })
                  }}
                  className="pointer-events-none absolute max-w-none select-none"
                  style={{
                    left: '50%',
                    top: '50%',
                    width: `${layout.width}px`,
                    height: `${layout.height}px`,
                    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                  }}
                />

                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/40">
                  <span className="absolute inset-y-0 left-1/3 border-l border-white/35" />
                  <span className="absolute inset-y-0 left-2/3 border-l border-white/35" />
                  <span className="absolute inset-x-0 top-1/3 border-t border-white/35" />
                  <span className="absolute inset-x-0 top-2/3 border-t border-white/35" />
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                  <span className="rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm">
                    Arrastre la imagen para reposicionarla
                  </span>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-zinc-500">
                Vista previa cuadrada · salida final de {PRODUCT_IMAGE_OUTPUT_SIZE} × {PRODUCT_IMAGE_OUTPUT_SIZE} px
              </p>
            </div>
          </div>

          <div className="flex min-h-0 flex-col border-t border-zinc-100 bg-white lg:overflow-y-auto lg:border-l lg:border-t-0">
            <div className="flex flex-1 flex-col gap-6 p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Encuadre</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => changeFitMode('crop')}
                    className={[
                      'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors',
                      fitMode === 'crop'
                        ? 'border-yellow-400 bg-yellow-50 text-zinc-900'
                        : 'border-zinc-200 text-zinc-500 hover:border-zinc-300',
                    ].join(' ')}
                  >
                    <CropIcon />
                    <span>
                      <span className="block text-xs font-semibold">Llenar y recortar</span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-zinc-400">Sin bordes blancos</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeFitMode('contain')}
                    className={[
                      'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors',
                      fitMode === 'contain'
                        ? 'border-yellow-400 bg-yellow-50 text-zinc-900'
                        : 'border-zinc-200 text-zinc-500 hover:border-zinc-300',
                    ].join(' ')}
                  >
                    <ImageIcon />
                    <span>
                      <span className="block text-xs font-semibold">Mostrar completa</span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-zinc-400">Con fondo blanco</span>
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="product-image-zoom" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Zoom
                  </label>
                  <span className="text-xs font-semibold tabular-nums text-zinc-700">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>
                <input
                  id="product-image-zoom"
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(event) => changeZoom(Number(event.target.value))}
                  className="mt-3 w-full accent-yellow-400"
                />
                <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
                  <span>100%</span>
                  <span>300%</span>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-zinc-700">Imagen original</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {naturalSize.width > 0
                        ? `${naturalSize.width.toLocaleString('es-CO')} × ${naturalSize.height.toLocaleString('es-CO')} px`
                        : 'Leyendo dimensiones…'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1)
                      setOffset({ x: 0, y: 0 })
                    }}
                    className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900"
                  >
                    Restablecer
                  </button>
                </div>

                {lowResolution && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-700">
                    La imagen tiene una resolución menor a la recomendada. Puede utilizarla, pero podría perder nitidez al ampliarse.
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs font-semibold text-emerald-800">Optimización automática</p>
                <p className="mt-1 text-[11px] leading-4 text-emerald-700">
                  La imagen se convertirá a JPG, se comprimirá con alta calidad y quedará lista en formato cuadrado para el catálogo.
                </p>
              </div>

              {processError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-600">
                  {processError}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <Button type="button" variant="secondary" onClick={onClose} disabled={processing}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={processing || !naturalSize.width || !cropSize}
          >
            {processing ? 'Procesando y subiendo…' : 'Usar y subir imagen'}
          </Button>
        </div>
      </div>
    </div>
  )
}
