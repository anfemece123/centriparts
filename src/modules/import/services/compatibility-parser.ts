// ─── Year-extraction regexes ─────────────────────────────────────────────────
//
// Order matters: long ranges are replaced before short ranges so their internal
// hyphens (e.g. "2010-2020") are neutralised before the hyphen-split pass.

// 4-digit range: "2010-2020", "2010 AL 2020", "2010–2020"
const LONG_YEAR_RANGE_RE  = /(\d{4})\s*(?:-|–|AL|al)\s*(\d{4})/gi

// 2-digit range: "95/97", "95-97", "83/97", "00/08"
// \b ensures we don't match inside longer numbers.
// Decimal-point engine specs (1.4/1.6) are excluded because \d{2} requires
// two consecutive digits with no intervening dot.
const SHORT_YEAR_RANGE_RE = /\b(\d{2})[/\-](\d{2})\b/g

// Open-ended start: "DESDE 2015"
const DESDE_RE            = /DESDE\s+(\d{4})/gi

// Single 4-digit year fallback (runs last so it doesn't absorb range digits)
const SINGLE_YEAR_RE      = /\b(\d{4})\b/g

// ─── Engine-notation regexes ─────────────────────────────────────────────────
//
// Explicit:  "MOT 1.4/1.6", "MOTOR 2.0"
const ENGINE_MOT_RE      = /\bMOT(?:OR)?\s+([\d.]+(?:\/[\d.]+)*)/i
// Implicit:  standalone "1.4/1.6", "2.0/2.5" — requires at least one slash
// Single decimal specs like "1.6" are left as part of the model name.
const ENGINE_IMPLICIT_RE = /\b(\d+\.\d+(?:\/\d+\.\d+)+)\b/

// ─── Universal values ────────────────────────────────────────────────────────

const UNIVERSAL_VALUES = new Set([
  'UNIVERSAL',
  'UNIVERSAL.',
  'TODOS',
  'TODOS LOS MODELOS',
  'TODOS LOS VEHICULOS',
  'TODOS LOS VEHÍCULOS',
  'APLICACION UNIVERSAL',
  'APLICACIÓN UNIVERSAL',
])

// ─── Public interface ─────────────────────────────────────────────────────────

export interface ParsedCompatibilityFragment {
  vehicleBrandName: string | null
  vehicleModelName: string | null
  yearFrom:         number | null
  yearTo:           number | null
  notes:            string | null
  rawFragment:      string
  parseStatus:      'auto' | 'partial'
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface YearToken {
  // Opaque placeholder inserted into the working string.
  // Uses null bytes (\x00) so it cannot appear in natural inventory text.
  placeholder:  string
  yearFrom:     number
  yearTo:       number | null
  // Original text that was replaced — used to reconstruct raw_source_fragment.
  originalText: string
}

// ─── Year helpers ─────────────────────────────────────────────────────────────

/**
 * Expands a two-digit year integer into a full year.
 *   00–30  →  2000–2030
 *   31–99  →  1931–1999
 */
function expandShortYear(yy: number): number {
  return yy <= 30 ? 2000 + yy : 1900 + yy
}

/**
 * Scans `text` for all year patterns, replaces each with an opaque placeholder,
 * and returns both the modified string and the token list.
 *
 * Replacement order:
 *   1. Long 4-digit ranges  (may contain a literal hyphen → neutralise first)
 *   2. Short 2-digit ranges (95/97, 83/97, 00/08, 95-97)
 *   3. DESDE keyword
 *   4. Single 4-digit year  (catch-all, runs last)
 */
function placeholderYears(text: string): { result: string; tokens: YearToken[] } {
  const tokens: YearToken[] = []
  let counter = 0

  function makeToken(originalText: string, yearFrom: number, yearTo: number | null): string {
    const placeholder = `\x00Y${counter++}\x00`
    tokens.push({ placeholder, yearFrom, yearTo, originalText })
    return placeholder
  }

  let result = text

  result = result.replace(LONG_YEAR_RANGE_RE, (match, a, b) =>
    makeToken(match, parseInt(a, 10), parseInt(b, 10)),
  )

  result = result.replace(SHORT_YEAR_RANGE_RE, (match, a, b) =>
    makeToken(match, expandShortYear(parseInt(a, 10)), expandShortYear(parseInt(b, 10))),
  )

  result = result.replace(DESDE_RE, (match, a) =>
    makeToken(match, parseInt(a, 10), null),
  )

  result = result.replace(SINGLE_YEAR_RE, (match, a) =>
    makeToken(match, parseInt(a, 10), null),
  )

  // Reset regex lastIndex (global regexes are stateful)
  LONG_YEAR_RANGE_RE.lastIndex  = 0
  SHORT_YEAR_RANGE_RE.lastIndex = 0
  DESDE_RE.lastIndex            = 0
  SINGLE_YEAR_RE.lastIndex      = 0

  return { result, tokens }
}

/** Replaces every placeholder in `text` with the token's original text. */
function restoreYears(text: string, tokens: YearToken[]): string {
  let result = text
  for (const token of tokens) {
    result = result.split(token.placeholder).join(token.originalText)
  }
  return result
}

// ─── Hyphen splitting ─────────────────────────────────────────────────────────

/**
 * Splits a placeholder-substituted string into compatibility blocks using
 * a two-tier heuristic:
 *
 *   Tier 1 (high confidence): hyphen immediately follows a year placeholder
 *           (\x00). A year naturally ends a compatibility block.
 *
 *   Tier 2 (conditional): hyphen where the text to the LEFT ends with a run
 *           of 3+ consecutive letters AND the remaining text on the RIGHT is
 *           at least 2 characters long. This splits "ASAHI-B2.2" correctly
 *           while preserving "F-150" (left side is only 1 letter).
 *
 * If neither condition is met, the hyphen is treated as part of the model text.
 */
function splitIntoBlocks(placeholdered: string): string[] {
  const segments: string[] = []
  let current = ''

  for (let i = 0; i < placeholdered.length; i++) {
    if (placeholdered[i] !== '-') {
      current += placeholdered[i]
      continue
    }

    // Tier 1: previous character is the closing \x00 of a year placeholder
    if (i > 0 && placeholdered[i - 1] === '\x00') {
      segments.push(current)
      current = ''
      continue
    }

    // Tier 2: left side ends with 3+ letters; right side has meaningful length
    const leftLetters   = /[A-Za-z]{3,}$/.test(current)
    const rightLength   = placeholdered.slice(i + 1).trimStart().length
    if (leftLetters && rightLength >= 2) {
      segments.push(current)
      current = ''
      continue
    }

    current += '-'
  }

  if (current) segments.push(current)
  return segments.map((s) => s.trim()).filter(Boolean)
}

// ─── Block parser ─────────────────────────────────────────────────────────────

/**
 * Parses a single placeholder-substituted block into a structured fragment.
 *
 * Steps:
 *   1. Reconstruct raw_source_fragment by restoring year placeholders.
 *   2. Extract year from the first placeholder found (never propagated from
 *      adjacent blocks — each block owns only the years it explicitly contains).
 *   3. Strip the vehicle brand hint from the beginning of the model text.
 *   4. Extract engine notation into `notes`.
 *   5. Determine parseStatus: 'partial' only when model text is empty.
 *      Year absence alone does NOT make a record partial.
 */
function parseBlock(
  placeholderSegment: string,
  tokens: YearToken[],
  vehicleBrandHint: string | null,
): ParsedCompatibilityFragment {
  // 1. raw_source_fragment — original text with years restored, brand included
  const rawFragment = restoreYears(placeholderSegment, tokens)
    .replace(/^[-–,.\s]+|[-–,.\s]+$/g, '')
    .trim()

  // 2. Extract year — only from placeholders present in this exact segment
  let yearFrom: number | null = null
  let yearTo:   number | null = null
  let modelText = placeholderSegment

  for (const token of tokens) {
    if (!modelText.includes(token.placeholder)) continue
    if (yearFrom === null) {
      yearFrom = token.yearFrom
      yearTo   = token.yearTo
    }
    // Remove placeholder from model text (replace with a space to preserve boundaries)
    modelText = modelText.split(token.placeholder).join(' ')
  }

  // 3. Initial cleanup
  modelText = modelText.replace(/^[-–,.\s]+|[-–,.\s]+$/g, '').trim()

  // 4. Strip brand prefix if present at the start
  const brandName = vehicleBrandHint?.trim() || null
  if (brandName && modelText.toUpperCase().startsWith(brandName.toUpperCase())) {
    modelText = modelText.substring(brandName.length).replace(/^[-–\s]+/, '').trim()
  }

  // 5. Extract engine notation into notes
  let notes: string | null = null

  const motMatch = modelText.match(ENGINE_MOT_RE)
  if (motMatch) {
    notes     = `Motor: ${motMatch[1]}`
    modelText = modelText.replace(motMatch[0], '').trim()
  } else {
    const implicitMatch = modelText.match(ENGINE_IMPLICIT_RE)
    if (implicitMatch) {
      notes     = `Motor: ${implicitMatch[1]}`
      modelText = modelText.replace(implicitMatch[0], '').trim()
    }
  }

  // 6. Final cleanup
  modelText = modelText.replace(/^[-–,.\s]+|[-–,.\s]+$/g, '').trim()

  const vehicleModelName = modelText || null
  const parseStatus: 'auto' | 'partial' = vehicleModelName ? 'auto' : 'partial'

  return {
    vehicleBrandName: brandName,
    vehicleModelName,
    yearFrom,
    yearTo,
    notes,
    rawFragment,
    parseStatus,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parses the raw USO/MODELO field into structured compatibility fragments.
 * vehicleBrandHint should be the raw MARCA CARROS value for the same row.
 * Returns partial records when parsing is incomplete — never drops data.
 *
 * Pipeline:
 *   1. Universal check — short-circuit for universal fitment strings.
 *   2. Primary split on commas and semicolons.
 *   3. For each primary fragment: placeholder years → hyphen split → parse blocks.
 */
export function parseCompatibilityText(
  rawText: string,
  vehicleBrandHint: string | null,
): ParsedCompatibilityFragment[] {
  const trimmed = rawText.trim()
  if (!trimmed) return []

  const upper = trimmed.toUpperCase().replace(/\s+/g, ' ')

  if (UNIVERSAL_VALUES.has(upper)) {
    return [
      {
        vehicleBrandName: null,
        vehicleModelName: null,
        yearFrom:         null,
        yearTo:           null,
        notes:            null,
        rawFragment:      trimmed,
        parseStatus:      'auto',
      },
    ]
  }

  // Primary split: commas and semicolons delimit independent entries
  const primaryFragments = trimmed
    .split(/[,;]/)
    .map((f) => f.trim())
    .filter(Boolean)

  const results: ParsedCompatibilityFragment[] = []

  for (const fragment of primaryFragments) {
    const { result: placeholdered, tokens } = placeholderYears(fragment)
    const blocks = splitIntoBlocks(placeholdered)

    for (const block of blocks) {
      results.push(parseBlock(block, tokens, vehicleBrandHint))
    }
  }

  return results
}
