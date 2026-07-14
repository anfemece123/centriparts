// Pure classification of the overall response status (spec section 21/13).
// Kept as its own tiny, directly-testable unit since "a category with zero
// indexed images returns a specific status" and "results still show up
// without an exact match" are both explicit test requirements (section 28).

import type { VisualSearchStatusV2 } from './visualSearchTypes.ts'

export function determineResponseStatus(params: {
  indexedImagesInScope: number
  hasExactMatch: boolean
  resultCount: number
}): VisualSearchStatusV2 {
  if (params.indexedImagesInScope === 0) return 'not_indexed'
  if (params.hasExactMatch) return 'exact_match'
  if (params.resultCount > 0) return 'results_found'
  return 'no_results'
}
