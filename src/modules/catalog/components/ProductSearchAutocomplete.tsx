import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { searchProductSuggestions } from '@/modules/catalog/services/products.service'
import { getPublicImageUrl } from '@/modules/catalog/services/product-images.service'
import type { ProductSearchSuggestion } from '@/types'

interface Props {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onSelectSuggestion: (suggestion: ProductSearchSuggestion) => void
  placeholder?: string
  publicOnly?: boolean
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m16.5 16.5 4 4" />
    </svg>
  )
}

function ImagePlaceholderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 17 5-5 4 4 2-2 5 4" />
    </svg>
  )
}

function resolveSuggestionImage(images: ProductSearchSuggestion['images']) {
  if (!Array.isArray(images) || images.length === 0) return null
  return [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1
    return a.display_order - b.display_order
  })[0]
}

function SuggestionThumbnail({ suggestion }: { suggestion: ProductSearchSuggestion }) {
  const [failed, setFailed] = useState(false)
  const image = resolveSuggestionImage(suggestion.images)
  const name = suggestion.display_name ?? suggestion.base_name

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {image && !failed ? (
        <img
          src={getPublicImageUrl(image.storage_path)}
          alt={image.alt_text ?? `Imagen de ${name}`}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span className="text-zinc-300"><ImagePlaceholderIcon /></span>
      )}
    </div>
  )
}

export default function ProductSearchAutocomplete({
  id,
  label,
  value,
  onChange,
  onSelectSuggestion,
  placeholder = 'Nombre, CI o referencia…',
  publicOnly = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)
  const focusedRef = useRef(false)
  const [suggestions, setSuggestions] = useState<ProductSearchSuggestion[]>([])
  const [completedQuery, setCompletedQuery] = useState('')
  const [loadingQuery, setLoadingQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const query = value.trim()
  const visibleSuggestions = completedQuery === query ? suggestions : []
  const isLoading = loadingQuery === query && query.length >= 2
  const showDropdown = open && query.length >= 2

  useEffect(() => {
    const requestId = ++requestIdRef.current
    if (query.length < 2) return

    const timeout = setTimeout(() => {
      setLoadingQuery(query)
      searchProductSuggestions(query, { publicOnly, limit: 6 })
        .then((results) => {
          if (requestId !== requestIdRef.current) return
          setSuggestions(results)
          setCompletedQuery(query)
          setActiveIndex(results.length > 0 ? 0 : -1)
          if (focusedRef.current) setOpen(true)
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return
          setSuggestions([])
          setCompletedQuery(query)
          setActiveIndex(-1)
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoadingQuery('')
        })
    }, 180)

    return () => clearTimeout(timeout)
  }, [query, publicOnly])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return
      focusedRef.current = false
      setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value
    const nextQuery = nextValue.trim()
    onChange(nextValue)
    setSuggestions([])
    setCompletedQuery('')
    setLoadingQuery(nextQuery.length >= 2 ? nextQuery : '')
    setActiveIndex(-1)
    setOpen(nextQuery.length >= 2)
  }

  function selectSuggestion(suggestion: ProductSearchSuggestion) {
    onChange(suggestion.display_name ?? suggestion.base_name)
    setOpen(false)
    focusedRef.current = false
    onSelectSuggestion(suggestion)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      if (visibleSuggestions.length > 0) {
        setActiveIndex((current) => (current + 1) % visibleSuggestions.length)
      }
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (visibleSuggestions.length > 0) {
        setActiveIndex((current) => (
          current <= 0 ? visibleSuggestions.length - 1 : current - 1
        ))
      }
      return
    }

    if (event.key === 'Enter' && showDropdown && activeIndex >= 0) {
      const suggestion = visibleSuggestions[activeIndex]
      if (suggestion) {
        event.preventDefault()
        selectSuggestion(suggestion)
      }
    }
  }

  return (
    <div ref={rootRef} className="relative flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-zinc-400">
          <SearchIcon />
        </span>
        <input
          id={id}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={`${id}-suggestions`}
          aria-activedescendant={activeIndex >= 0 ? `${id}-suggestion-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => {
            focusedRef.current = true
            if (query.length >= 2) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-colors focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
        />
      </div>

      {showDropdown && (
        <div
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl shadow-black/10"
        >
          {isLoading ? (
            <div className="flex items-center gap-3 px-4 py-4 text-sm text-zinc-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-yellow-400" />
              Buscando coincidencias…
            </div>
          ) : visibleSuggestions.length > 0 ? (
            <div className="max-h-80 overflow-y-auto py-1.5">
              {visibleSuggestions.map((suggestion, index) => {
                const name = suggestion.display_name ?? suggestion.base_name
                return (
                  <button
                    key={suggestion.id}
                    id={`${id}-suggestion-${index}`}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectSuggestion(suggestion)}
                    className={[
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                      activeIndex === index ? 'bg-yellow-50' : 'hover:bg-zinc-50',
                    ].join(' ')}
                  >
                    <SuggestionThumbnail suggestion={suggestion} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-zinc-900">{name}</span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-zinc-500">
                        CI {suggestion.ci}{suggestion.reference ? ` · Ref. ${suggestion.reference}` : ''}
                      </span>
                    </span>
                    <span className="text-sm text-zinc-300" aria-hidden="true">→</span>
                  </button>
                )
              })}
            </div>
          ) : completedQuery === query ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-medium text-zinc-700">Sin coincidencias rápidas</p>
              <p className="mt-1 text-xs text-zinc-400">La lista continuará buscando con el texto completo.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
