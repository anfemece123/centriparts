import type { ProductImportData } from '@/types'

const REQUIRED_HEADERS = [
  'CI',
  'PRODUCTO',
  'TIPO',
  'MARCA',
  'MARCA CARROS',
  'PRECIO DE VENTA',
  'STOCK',
] as const

// Normalize a single header string for comparison:
// trim, uppercase, strip diacritics.
// Applied both to CSV headers on ingestion and to REQUIRED_HEADERS during validation.
function normalizeHeader(h: string): string {
  return h
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const NORMALIZED_REQUIRED = REQUIRED_HEADERS.map(normalizeHeader)

export function parseCsvText(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []

  // Detect delimiter once from the header line and reuse for all subsequent lines
  const delimiter = detectDelimiter(lines[0])
  const rawHeaders = parseCsvLine(lines[0], delimiter)
  // Build a map from normalized header → original position so downstream
  // code always receives the normalized key as the record key.
  const normalizedHeaders = rawHeaders.map(normalizeHeader)
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCsvLine(line, delimiter)
    const row: Record<string, string> = {}
    normalizedHeaders.forEach((header, idx) => {
      row[header] = (values[idx] ?? '').trim()
    })
    rows.push(row)
  }

  return rows
}

// Detects whether the file uses semicolons or commas as the field delimiter.
// Counts raw occurrences in the header line — reliable because header values
// never contain embedded delimiters. Defaults to comma if counts are equal.
function detectDelimiter(headerLine: string): ',' | ';' {
  const commas     = (headerLine.match(/,/g) ?? []).length
  const semicolons = (headerLine.match(/;/g) ?? []).length
  return semicolons > commas ? ';' : ','
}

function parseCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      i++
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

export function validateCsvHeaders(headers: string[]): {
  valid: boolean
  missing: string[]
} {
  // headers arriving here are already normalized by parseCsvText
  const missing = NORMALIZED_REQUIRED.filter((required) => !headers.includes(required))
  // Report missing headers using their original (readable) names
  const missingOriginal = REQUIRED_HEADERS.filter(
    (_, i) => !headers.includes(NORMALIZED_REQUIRED[i]),
  )
  return { valid: missing.length === 0, missing: missingOriginal }
}

export function mapRowToImportData(row: Record<string, string>): ProductImportData {
  // All keys in `row` are already normalized (uppercase, no diacritics, trimmed)
  return {
    ci:                 (row['CI'] ?? '').trim(),
    base_name:          (row['PRODUCTO'] ?? '').trim(),
    reference:          (row['REFERENCIA'] ?? '').trim() || null,
    description:        (row['DESCRIPCION LARGA'] ?? '').trim() || null,
    sale_price:         parsePrice(row['PRECIO DE VENTA'] ?? ''),
    cost_price:         parsePrice(row['COSTO INICIAL'] ?? ''),
    stock:              parseStock(row['STOCK'] ?? ''),
    raw_compatibility:  (row['USO/MODELO'] ?? '').trim() || null,
    product_type_name:  (row['TIPO'] ?? '').trim() || null,
    product_brand_name: (row['MARCA'] ?? '').trim() || null,
    vehicle_brand_name: (row['MARCA CARROS'] ?? '').trim() || null,
  }
}

// Parses price strings produced by Colombian/Latin American CSV exports.
//
// Supported formats:
//   Both separators — last one is the decimal:
//     1.250,50  → 1250.5   (Colombian: period=thousands, comma=decimal)
//     1,250.50  → 1250.5   (US: comma=thousands, period=decimal)
//   Only commas:
//     1,250,000 → 1250000  (multiple → all thousands)
//     1,250     → 1250     (one + 3 trailing digits → thousands)
//     1250,50   → 1250.5   (one + 1-2 trailing digits → decimal)
//   Only periods:
//     1.250.000 → 1250000  (multiple → all thousands)
//     1.250     → 1250     (one + 3 trailing digits → thousands)
//     1250.50   → 1250.5   (one + 1-2 trailing digits → decimal)
//   No separator:
//     125000    → 125000
export function parsePrice(value: string): number {
  const s = value.replace(/[^0-9.,]/g, '').trim()
  if (!s) return 0

  const hasComma = s.includes(',')
  const hasPeriod = s.includes('.')
  let normalized: string

  if (hasComma && hasPeriod) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // e.g. 1.250,50 — comma is decimal separator
      normalized = s.replace(/\./g, '').replace(',', '.')
    } else {
      // e.g. 1,250.50 — period is decimal separator
      normalized = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    const parts = s.split(',')
    if (parts.length > 2) {
      normalized = parts.join('')                // 1,250,000 → 1250000
    } else if (parts[1].length === 3) {
      normalized = parts.join('')                // 1,250 → 1250
    } else {
      normalized = s.replace(',', '.')           // 1250,50 → 1250.50
    }
  } else if (hasPeriod) {
    const parts = s.split('.')
    if (parts.length > 2) {
      normalized = parts.join('')                // 1.250.000 → 1250000
    } else if (parts[1].length === 3) {
      normalized = parts.join('')                // 1.250 → 1250
    } else {
      normalized = s                             // 1250.50 → unchanged
    }
  } else {
    normalized = s                               // 125000 → unchanged
  }

  const parsed = parseFloat(normalized)
  return isNaN(parsed) || parsed < 0 ? 0 : parsed
}

function parseStock(value: string): number {
  const parsed = parseInt(value.replace(/[^0-9]/g, ''), 10)
  return isNaN(parsed) ? 0 : parsed
}
