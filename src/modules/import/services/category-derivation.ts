export interface DerivedProductCategory {
  mainCategory: string
  subcategory: string | null
}

/**
 * Inventory rule: the first word in PRODUCTO is the main category and the
 * complete multi-word value is its subcategory. Examples:
 *   BOMBILLO     -> BOMBILLO / no subcategory
 *   BOMBILLO LED -> BOMBILLO / BOMBILLO LED
 */
export function deriveProductCategory(baseName: string): DerivedProductCategory | null {
  const normalizedName = baseName.trim().replace(/\s+/g, ' ')
  if (!normalizedName) return null

  const words = normalizedName.split(' ')
  return {
    mainCategory: words[0],
    subcategory: words.length > 1 ? normalizedName : null,
  }
}
