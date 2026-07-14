import { createPortal } from 'react-dom'
import type { ProductListItem } from '@/types'

const MAX_VISIBLE_ITEMS = 6
const CARD_WIDTH = 360
const VIEWPORT_GAP = 12

type Compatibility = ProductListItem['compatibility'][number]

interface ProductCompatibilityTooltipProps {
  product: ProductListItem
  anchorRect: DOMRect
}

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 17h14M6.5 17v2M17.5 17v2M4 13l1.7-5.1A2 2 0 0 1 7.6 6.5h8.8a2 2 0 0 1 1.9 1.4L20 13M5.5 13h13a1.5 1.5 0 0 1 1.5 1.5V17H4v-2.5A1.5 1.5 0 0 1 5.5 13Z" />
      <path strokeLinecap="round" d="M7 14.8h.01M17 14.8h.01" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 10 3 3 7-7" />
    </svg>
  )
}

function formatYears(item: Compatibility): string {
  if (item.year_from && item.year_to) return `${item.year_from}–${item.year_to}`
  if (item.year_from) return `Desde ${item.year_from}`
  if (item.year_to) return `Hasta ${item.year_to}`
  return 'Todos los años'
}

function getApplicationName(item: Compatibility): { brand: string; model: string } {
  return {
    brand: item.vehicle_brand?.name ?? 'Todas las marcas',
    model: item.vehicle_model?.name ?? 'Todos los modelos',
  }
}

export default function ProductCompatibilityTooltip({
  product,
  anchorRect,
}: ProductCompatibilityTooltipProps) {
  if (typeof document === 'undefined') return null

  const compatibility = Array.isArray(product.compatibility) ? product.compatibility : []
  const visibleItems = compatibility.slice(0, MAX_VISIBLE_ITEMS)
  const remainingCount = Math.max(0, compatibility.length - visibleItems.length)
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const width = Math.min(CARD_WIDTH, viewportWidth - VIEWPORT_GAP * 2)
  const estimatedHeight = compatibility.length === 0
    ? 188
    : 118 + visibleItems.length * 63 + (remainingCount > 0 ? 34 : 0)
  const left = Math.min(
    Math.max(anchorRect.left + 24, VIEWPORT_GAP),
    viewportWidth - width - VIEWPORT_GAP,
  )
  const hasRoomBelow = anchorRect.bottom + 10 + estimatedHeight <= viewportHeight - VIEWPORT_GAP
  const top = hasRoomBelow
    ? anchorRect.bottom + 10
    : Math.max(VIEWPORT_GAP, anchorRect.top - estimatedHeight - 10)
  const productName = product.display_name ?? product.base_name

  return createPortal(
    <aside
      role="tooltip"
      aria-label={`Compatibilidad de ${productName}`}
      style={{ left, top, width }}
      className="pointer-events-none fixed z-[100] overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-[0_22px_60px_-18px_rgba(24,24,27,0.35)]"
    >
      <div className="h-1 bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-500" />
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-amber-600 ring-1 ring-yellow-200">
            <CarIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-zinc-950">Compatibilidad</p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">{productName}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold tabular-nums text-zinc-600">
          {compatibility.length} {compatibility.length === 1 ? 'aplicación' : 'aplicaciones'}
        </span>
      </div>

      {visibleItems.length > 0 ? (
        <div className="divide-y divide-zinc-100 px-4">
          {visibleItems.map((item) => {
            const { brand, model } = getApplicationName(item)

            return (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-zinc-900">
                    {brand} <span className="font-normal text-zinc-300">·</span> {model}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-zinc-500">{formatYears(item)}</p>
                </div>
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${
                    item.is_verified
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                      : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
                  }`}
                >
                  {item.is_verified && <CheckIcon />}
                  {item.is_verified ? 'Verificada' : 'Por verificar'}
                </span>
              </div>
            )
          })}

          {remainingCount > 0 && (
            <p className="py-2.5 text-center text-[11px] font-semibold text-amber-700">
              +{remainingCount} {remainingCount === 1 ? 'aplicación adicional' : 'aplicaciones adicionales'}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center px-6 py-7 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <CarIcon />
          </span>
          <p className="mt-3 text-xs font-semibold text-zinc-800">Sin compatibilidad registrada</p>
          <p className="mt-1 max-w-[260px] text-[11px] leading-relaxed text-zinc-500">
            Abra el producto para agregar marcas, modelos y rangos de años.
          </p>
        </div>
      )}
    </aside>,
    document.body,
  )
}
