import { Link } from 'react-router-dom'
import { Badge, getButtonClassName } from '@/shared/components/ui'
import type { NormalizedVisualSearchResult } from '@/types'

// Keyed by the canonical Spanish labels the normalizer produces
// (normalizeVisualSearchResponse falls back to 'Relacionada' for anything
// it doesn't recognize) — but `similarityLabel` is typed as a plain
// `string` on the normalized contract, so this component still guards with
// a fallback instead of assuming the lookup can never miss.
const SIMILARITY_BADGE: Record<string, 'success' | 'info' | 'warning' | 'default'> = {
  'Referencia exacta': 'success',
  'Muy alta': 'success',
  Alta: 'info',
  Media: 'warning',
  Relacionada: 'default',
}

const SIMILARITY_TEXT: Record<string, string> = {
  'Referencia exacta': 'Coincidencia por referencia',
  'Muy alta': 'Muy alta similitud',
  Alta: 'Alta similitud',
  Media: 'Posible coincidencia',
  Relacionada: 'Componente relacionado',
}

interface Props {
  result: NormalizedVisualSearchResult
  /** Display order within the current results list — not part of the
   * normalized contract itself, just how the panel numbers the cards. */
  position?: number
}

// No JSON, embeddings, prompts, model names, or AI-generated descriptions
// are ever rendered here (spec section 2/21) — only catalog data plus the
// similarity label.
export default function VisualSearchResultCard({ result, position }: Props) {
  const isExact = result.matchType === 'exact_reference'
  const compatibilitySummary = Array.isArray(result.compatibilitySummary) ? result.compatibilitySummary : []

  return (
    <div
      className={[
        'flex flex-col overflow-hidden rounded-xl border bg-white',
        isExact ? 'border-yellow-300 shadow-sm' : 'border-zinc-200',
      ].join(' ')}
    >
      <div className="flex gap-4 p-4">
        <div className="flex shrink-0 gap-2">
          <div className="h-20 w-20 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50">
            {result.primaryImageUrl ? (
              <img src={result.primaryImageUrl} alt={result.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-300">
                Sin imagen
              </div>
            )}
          </div>
          {result.matchedImageUrl && result.matchedImageUrl !== result.primaryImageUrl && (
            <div className="h-20 w-20 overflow-hidden rounded-lg border border-zinc-100 bg-zinc-50">
              <img src={result.matchedImageUrl} alt="Imagen coincidente" className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {typeof position === 'number' && <span className="text-xs font-semibold text-zinc-400">#{position}</span>}
            <Badge
              label={SIMILARITY_TEXT[result.similarityLabel] ?? result.similarityLabel}
              variant={SIMILARITY_BADGE[result.similarityLabel] ?? 'default'}
            />
          </div>

          <h3 className="truncate text-sm font-semibold text-zinc-900">{result.name}</h3>

          <p className="text-xs text-zinc-500">
            CI: <span className="font-mono">{result.ci}</span>
            {result.reference && (
              <>
                {' '}
                · Ref: <span className="font-mono">{result.reference}</span>
              </>
            )}
            {result.brand && <> · {result.brand}</>}
          </p>

          {result.categoryName && <p className="text-xs text-zinc-400">{result.categoryName}</p>}

          {compatibilitySummary.length > 0 && (
            <p className="truncate text-xs text-zinc-400">
              Compatible: {compatibilitySummary.slice(0, 2).join(', ')}
              {compatibilitySummary.length > 2 ? '…' : ''}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-4 py-3">
        <Link to={result.productUrl} className={getButtonClassName({ size: 'sm' })}>
          Ver producto
        </Link>
      </div>
    </div>
  )
}
