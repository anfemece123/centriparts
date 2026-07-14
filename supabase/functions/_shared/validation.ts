import type { AutomotivePartImageAnalysis, ImageQuality, RerankCandidateResult, RerankVerdict } from './types.ts'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

const IMAGE_QUALITIES: ImageQuality[] = ['excellent', 'good', 'limited', 'poor']
const RERANK_VERDICTS: RerankVerdict[] = ['exact', 'probable', 'similar', 'not_match']

/** Validates the OpenAI structured output before it is trusted anywhere. */
export function isAutomotivePartImageAnalysis(value: unknown): value is AutomotivePartImageAnalysis {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  const nullableString = (x: unknown) => x === null || typeof x === 'string'

  return (
    typeof v.isAutomotivePart === 'boolean' &&
    typeof v.imageQuality === 'string' &&
    IMAGE_QUALITIES.includes(v.imageQuality as ImageQuality) &&
    nullableString(v.viewAngle) &&
    nullableString(v.partType) &&
    nullableString(v.categoryGuess) &&
    nullableString(v.brandVisible) &&
    nullableString(v.manufacturerVisible) &&
    isStringArray(v.referenceCodes) &&
    isStringArray(v.oemCodes) &&
    isStringArray(v.barcodes) &&
    isStringArray(v.printedText) &&
    isStringArray(v.materials) &&
    isStringArray(v.colors) &&
    nullableString(v.generalShape) &&
    (v.connectorCount === null || typeof v.connectorCount === 'number') &&
    nullableString(v.connectorType) &&
    isStringArray(v.mountingPoints) &&
    isStringArray(v.holesAndThreads) &&
    isStringArray(v.distinctiveFeatures) &&
    isStringArray(v.visibleDamageOrWear) &&
    typeof v.searchDescription === 'string' &&
    isStringArray(v.warnings)
  )
}

function isRerankCandidateResult(value: unknown): value is RerankCandidateResult {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>

  return (
    typeof v.product_id === 'string' &&
    typeof v.verdict === 'string' &&
    RERANK_VERDICTS.includes(v.verdict as RerankVerdict) &&
    typeof v.confidence === 'number' &&
    v.confidence >= 0 &&
    v.confidence <= 1 &&
    isStringArray(v.decisive_matches) &&
    isStringArray(v.contradictions) &&
    typeof v.reference_match === 'boolean' &&
    typeof v.brand_match === 'boolean' &&
    typeof v.shape_match === 'boolean' &&
    typeof v.connector_match === 'boolean' &&
    typeof v.mounting_match === 'boolean' &&
    typeof v.visible_text_match === 'boolean'
  )
}

export function isRerankCandidateResultArray(value: unknown): value is RerankCandidateResult[] {
  return Array.isArray(value) && value.every(isRerankCandidateResult)
}
