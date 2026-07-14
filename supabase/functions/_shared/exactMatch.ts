import { ciMatches, referenceCodesMatch } from './normalizeReferenceCode.ts'

export interface ExactMatchQuery {
  ci: string | null
  referenceCodes: string[]
  oemCodes: string[]
}

export interface ExactMatchCandidate {
  productId: string
  ci: string
  reference: string | null
  oemCodes: string[]
  categoryIds: string[]
}

export interface ExactMatchResult {
  productId: string
  matchedField: 'ci' | 'reference' | 'oem'
}

/**
 * Deterministic matching (Etapa C). `candidates` should already be a small,
 * loosely-prefiltered set from the database (e.g. by CI or ILIKE reference);
 * this function performs the strict, safe confirmation and enforces the
 * category scope so a same-reference product from another category never
 * slips through. CI has maximum priority and zero fuzzy tolerance.
 */
export function findExactReferenceMatches(
  query: ExactMatchQuery,
  candidates: ExactMatchCandidate[],
  allowedCategoryIds: string[] | null,
): ExactMatchResult[] {
  const inScope = (candidate: ExactMatchCandidate): boolean =>
    allowedCategoryIds === null || candidate.categoryIds.some((id) => allowedCategoryIds.includes(id))

  const results: ExactMatchResult[] = []

  for (const candidate of candidates) {
    if (!inScope(candidate)) continue

    if (query.ci && ciMatches(query.ci, candidate.ci)) {
      results.push({ productId: candidate.productId, matchedField: 'ci' })
      continue
    }

    if (
      candidate.reference &&
      query.referenceCodes.some((code) => referenceCodesMatch(code, candidate.reference!))
    ) {
      results.push({ productId: candidate.productId, matchedField: 'reference' })
      continue
    }

    const oemHit = candidate.oemCodes.some((oem) =>
      query.oemCodes.some((code) => referenceCodesMatch(code, oem)),
    )
    if (oemHit) {
      results.push({ productId: candidate.productId, matchedField: 'oem' })
    }
  }

  return results
}
