// Normalization rules for reference/OEM codes and the CI identifier.
//
// CI has zero tolerance for fuzzy matching (spec section 6, Etapa C):
// it is compared as a trimmed exact string, never normalized/uppercased,
// never matched approximately.
//
// Reference/OEM codes are normalized (uppercased, separators stripped) but
// short or purely-numeric strings are flagged as non-viable so they can
// never produce a dangerous partial/coincidental match (e.g. a page count
// or quantity being confused with a real reference).

export interface NormalizedCode {
  /** Exactly what was read/typed, for display purposes. */
  original: string
  /** Uppercased, separator-stripped form used for comparison. */
  normalized: string
  /** False for codes too short or too generic to safely match on. */
  isViable: boolean
}

const SEPARATOR_PATTERN = /[\s\-_./\\]+/g

const MIN_ALPHANUMERIC_LENGTH = 4
const MIN_NUMERIC_ONLY_LENGTH = 5

export function normalizeReferenceCode(raw: string): NormalizedCode {
  const original = raw
  const normalized = raw.toUpperCase().trim().replace(SEPARATOR_PATTERN, '')

  if (normalized.length === 0) {
    return { original, normalized, isViable: false }
  }

  const isNumericOnly = /^[0-9]+$/.test(normalized)
  const minLength = isNumericOnly ? MIN_NUMERIC_ONLY_LENGTH : MIN_ALPHANUMERIC_LENGTH
  const isViable = normalized.length >= minLength

  return { original, normalized, isViable }
}

/** Reference/OEM comparison: both sides must be viable and normalize identically. */
export function referenceCodesMatch(a: string, b: string): boolean {
  const na = normalizeReferenceCode(a)
  const nb = normalizeReferenceCode(b)
  if (!na.isViable || !nb.isViable) return false
  return na.normalized === nb.normalized
}

/** CI is trimmed only — never uppercased, never fuzzy-matched. */
export function normalizeCI(raw: string): string {
  return raw.trim()
}

export function ciMatches(a: string, b: string): boolean {
  const na = normalizeCI(a)
  const nb = normalizeCI(b)
  return na.length > 0 && na === nb
}
