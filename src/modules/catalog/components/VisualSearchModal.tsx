import { useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/components/ui'
import CategoryScopeSelector from './CategoryScopeSelector'
import VisualSearchResultCard from './VisualSearchResultCard'
import { listCategories } from '@/modules/catalog/services/categories.service'
import { searchProductByImage } from '@/modules/catalog/services/visual-search.service'
import type { Category, NormalizedVisualSearchResponse, VisualSearchErrorResponse } from '@/types'

interface Props {
  onClose: () => void
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'preview' }
  | { kind: 'searching' }
  | { kind: 'result'; data: NormalizedVisualSearchResponse }
  | { kind: 'error'; error: VisualSearchErrorResponse }

const CATEGORY_SCOPED_ERROR_CODES = new Set(['category_without_products', 'category_without_indexed_images'])

// Rotating messages while the search request is in flight (spec section 22)
// — this is a single request/response call, not a streamed multi-stage
// pipeline, so these are a progress *indication* for the user, not a
// literal readout of backend stages.
const SEARCHING_MESSAGES = [
  'Preparando imagen…',
  'Generando huella visual…',
  'Buscando componentes similares…',
  'Comparando los mejores resultados…',
]

export default function VisualSearchModal({ onClose }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)

  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [searchMessageIndex, setSearchMessageIndex] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    listCategories().then(setCategories).catch(() => {})
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (stage.kind !== 'searching') return
    // Reset happens in runSearch() (an event handler), right before this
    // effect starts — not here, since setState must not run synchronously
    // in an effect body. This effect only advances the message on a timer.
    const interval = setInterval(() => {
      setSearchMessageIndex((i) => Math.min(i + 1, SEARCHING_MESSAGES.length - 1))
    }, 1100)
    return () => clearInterval(interval)
  }, [stage.kind])

  function handleFileSelected(selected: File | null) {
    if (!selected) return
    setFile(selected)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(selected)
    })
    setStage({ kind: 'preview' })
  }

  function handleRemoveImage() {
    setFile(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setStage({ kind: 'idle' })
  }

  async function runSearch(categoryOverride?: string | null) {
    if (!file) return
    const effectiveCategoryId = categoryOverride !== undefined ? categoryOverride : categoryId || null
    setSearchMessageIndex(0)
    setStage({ kind: 'searching' })

    const result = await searchProductByImage({ image: file, categoryId: effectiveCategoryId })
    if (!mountedRef.current) return

    if (categoryOverride !== undefined) setCategoryId(effectiveCategoryId ?? '')

    if (result.ok) {
      setStage({ kind: 'result', data: result.data })
    } else {
      setStage({ kind: 'error', error: result.error })
    }
  }

  const showCategoryFallback =
    (stage.kind === 'error' && CATEGORY_SCOPED_ERROR_CODES.has(stage.error.code)) ||
    (stage.kind === 'result' &&
      (stage.data.status === 'not_indexed' || stage.data.status === 'no_results') &&
      !stage.data.scope.isGlobalSearch)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-900">Buscar componente por foto</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {stage.kind !== 'result' && (
            <div className="mb-5">
              <CategoryScopeSelector
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
                disabled={stage.kind === 'searching'}
              />
            </div>
          )}

          {stage.kind === 'idle' && (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFileSelected(e.dataTransfer.files?.[0] ?? null)
              }}
              className={[
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
                dragOver ? 'border-yellow-400 bg-yellow-50' : 'border-zinc-200',
              ].join(' ')}
            >
              <p className="text-sm text-zinc-500">Arrastre una foto aquí, o</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                  Elegir archivo
                </Button>
                <Button size="sm" variant="secondary" onClick={() => cameraInputRef.current?.click()}>
                  Tomar foto
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          {(stage.kind === 'preview' || stage.kind === 'searching') && previewUrl && (
            <div className="flex flex-col items-center gap-4">
              <div className="aspect-square w-56 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                <img src={previewUrl} alt="Vista previa" className="h-full w-full object-cover" />
              </div>

              {stage.kind === 'preview' && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                    Cambiar foto
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRemoveImage}>
                    Eliminar
                  </Button>
                </div>
              )}

              {stage.kind === 'searching' && (
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-yellow-400" />
                  <p className="text-sm text-zinc-500">{SEARCHING_MESSAGES[searchMessageIndex]}</p>
                </div>
              )}
            </div>
          )}

          {stage.kind === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-red-500">{stage.error.message}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setStage({ kind: 'preview' })}>
                  Reintentar
                </Button>
                {showCategoryFallback && (
                  <Button size="sm" onClick={() => runSearch(null)}>
                    Buscar en todo el catálogo
                  </Button>
                )}
              </div>
            </div>
          )}

          {stage.kind === 'result' && (
            <ResultsPanel data={stage.data} onSearchGlobally={() => runSearch(null)} />
          )}
        </div>

        {(stage.kind === 'preview' || stage.kind === 'idle') && file && (
          <div className="border-t border-zinc-100 px-5 py-4">
            <Button className="w-full" onClick={() => runSearch()} disabled={!file}>
              Buscar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ResultsPanel({
  data,
  onSearchGlobally,
}: {
  data: NormalizedVisualSearchResponse
  onSearchGlobally: () => void
}) {
  const canOfferGlobalSearch = !data.scope.isGlobalSearch
  // Belt-and-suspenders: normalizeVisualSearchResponse already guarantees
  // `results` is always an array, but this component must never trust a
  // single upstream layer to prevent a crash — if `data` ever arrives
  // shaped unexpectedly, render the empty state instead of throwing.
  const safeResults = Array.isArray(data.results) ? data.results : []

  if (data.status === 'not_indexed') {
    const scopeLabel = data.scope.isGlobalSearch ? 'el catálogo' : data.scope.selectedCategoryName ?? 'esta categoría'
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-zinc-500">
          {data.scope.isGlobalSearch
            ? 'Todavía no hay imágenes indexadas en el catálogo.'
            : `La categoría "${scopeLabel}" todavía no tiene imágenes indexadas.`}
        </p>
        {canOfferGlobalSearch && (
          <Button size="sm" onClick={onSearchGlobally}>
            Buscar en todo el catálogo
          </Button>
        )}
      </div>
    )
  }

  if (data.status === 'no_results') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-zinc-500">No se encontraron componentes relacionados.</p>
        {canOfferGlobalSearch && (
          <p className="text-xs text-zinc-400">
            La imagen podría corresponder a una categoría diferente de{' '}
            {data.scope.selectedCategoryName ?? 'la seleccionada'}.
          </p>
        )}
        {canOfferGlobalSearch && (
          <Button size="sm" onClick={onSearchGlobally}>
            Buscar en todo el catálogo
          </Button>
        )}
      </div>
    )
  }

  // exact_match | results_found — but a contract mismatch could in
  // principle report one of these statuses with no actual results, so this
  // still has to fall back to a renderable empty state instead of an
  // empty-but-"successful"-looking panel.
  if (safeResults.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-zinc-500">No se encontraron componentes relacionados.</p>
        {canOfferGlobalSearch && (
          <Button size="sm" onClick={onSearchGlobally}>
            Buscar en todo el catálogo
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium text-zinc-700">Resultados ordenados por similitud visual</p>
        <p className="mt-1 text-xs text-zinc-400">
          Verifique la referencia y la compatibilidad del vehículo antes de seleccionar el componente.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {safeResults.map((result, index) => (
          <VisualSearchResultCard key={result.productId} result={result} position={index + 1} />
        ))}
      </div>

      {canOfferGlobalSearch && (
        <div className="flex flex-col items-center gap-2 border-t border-zinc-100 pt-4 text-center">
          <p className="text-sm text-zinc-500">¿No encontró el componente?</p>
          <Button size="sm" variant="secondary" onClick={onSearchGlobally}>
            Buscar en todas las categorías
          </Button>
        </div>
      )}
    </div>
  )
}
