import { supabase } from '@/lib/supabase'
import { deriveProductCategory } from '@/modules/import/services/category-derivation'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NameConfidence = 'clear' | 'ambiguous'

export interface NameAnalysisRow {
  id: string
  base_name: string
  detected_category: string | null
  detected_subcategory: string | null
  confidence: NameConfidence
  note: string | null
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Business rule:
 *   - First word of base_name → main category
 *   - Remaining words        → subcategory (null if only one word)
 *   - Ambiguous only when base_name is empty or unparseable
 */
export function parseProductName(product: { id: string; base_name: string }): NameAnalysisRow {
  const derived = deriveProductCategory(product.base_name)

  if (!derived) {
    return {
      id: product.id,
      base_name: product.base_name,
      detected_category: null,
      detected_subcategory: null,
      confidence: 'ambiguous',
      note: 'Nombre vacío.',
    }
  }

  return {
    id: product.id,
    base_name: product.base_name,
    detected_category: derived.mainCategory,
    detected_subcategory: derived.subcategory
      ? derived.subcategory.slice(derived.mainCategory.length).trim()
      : null,
    confidence: 'clear',
    note: derived.subcategory === null ? 'Una sola palabra; sin subcategoría.' : null,
  }
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000

/**
 * Fetches every product from the database using range-based pagination.
 * Supabase returns at most 1000 rows per request by default; this loops
 * until all pages are consumed.
 */
export async function fetchAllProducts(): Promise<{ id: string; base_name: string }[]> {
  const results: { id: string; base_name: string }[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, base_name')
      .order('base_name', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    results.push(...(data as { id: string; base_name: string }[]))

    if (data.length < PAGE_SIZE) break   // last page — no need for another round-trip
    from += PAGE_SIZE
  }

  return results
}

/** Fetches all products and runs name analysis over the full catalog. */
export async function analyzeProductNames(): Promise<NameAnalysisRow[]> {
  const products = await fetchAllProducts()
  return products.map(parseProductName)
}
