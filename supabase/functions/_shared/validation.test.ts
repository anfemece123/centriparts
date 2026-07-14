import { describe, expect, it } from 'vitest'
import { isAutomotivePartImageAnalysis, isRerankCandidateResultArray } from './validation.ts'

function validAnalysis() {
  return {
    isAutomotivePart: true,
    imageQuality: 'good',
    viewAngle: null,
    partType: 'Bobina',
    categoryGuess: 'Bobinas',
    brandVisible: null,
    manufacturerVisible: null,
    referenceCodes: ['0221504470'],
    oemCodes: [],
    barcodes: [],
    printedText: [],
    materials: [],
    colors: [],
    generalShape: null,
    connectorCount: 4,
    connectorType: null,
    mountingPoints: [],
    holesAndThreads: [],
    distinctiveFeatures: [],
    visibleDamageOrWear: [],
    searchDescription: 'cuerpo cilíndrico',
    warnings: [],
  }
}

describe('isAutomotivePartImageAnalysis', () => {
  it('accepts a well-formed structured output', () => {
    expect(isAutomotivePartImageAnalysis(validAnalysis())).toBe(true)
  })

  it('rejects a response missing a required field', () => {
    const { searchDescription: _drop, ...broken } = validAnalysis()
    expect(isAutomotivePartImageAnalysis(broken)).toBe(false)
  })

  it('rejects an invalid enum value for imageQuality', () => {
    expect(isAutomotivePartImageAnalysis({ ...validAnalysis(), imageQuality: 'perfect' })).toBe(false)
  })

  it('rejects wrong types (array field sent as string)', () => {
    expect(isAutomotivePartImageAnalysis({ ...validAnalysis(), referenceCodes: 'ABC123' })).toBe(false)
  })

  it('rejects non-objects outright', () => {
    expect(isAutomotivePartImageAnalysis(null)).toBe(false)
    expect(isAutomotivePartImageAnalysis('not an object')).toBe(false)
    expect(isAutomotivePartImageAnalysis(42)).toBe(false)
  })
})

describe('isRerankCandidateResultArray', () => {
  function validCandidate() {
    return {
      product_id: 'p1',
      verdict: 'probable',
      confidence: 0.8,
      decisive_matches: ['forma coincide'],
      contradictions: [],
      reference_match: false,
      brand_match: true,
      shape_match: true,
      connector_match: true,
      mounting_match: false,
      visible_text_match: false,
    }
  }

  it('accepts a well-formed candidate array', () => {
    expect(isRerankCandidateResultArray([validCandidate()])).toBe(true)
  })

  it('rejects an invalid verdict value', () => {
    expect(isRerankCandidateResultArray([{ ...validCandidate(), verdict: 'maybe' }])).toBe(false)
  })

  it('rejects confidence outside the 0..1 range', () => {
    expect(isRerankCandidateResultArray([{ ...validCandidate(), confidence: 1.5 }])).toBe(false)
  })

  it('rejects a non-array payload', () => {
    expect(isRerankCandidateResultArray(validCandidate())).toBe(false)
  })
})
