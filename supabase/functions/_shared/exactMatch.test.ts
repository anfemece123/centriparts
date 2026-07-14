import { describe, expect, it } from 'vitest'
import { findExactReferenceMatches, type ExactMatchCandidate } from './exactMatch.ts'

function candidate(overrides: Partial<ExactMatchCandidate> = {}): ExactMatchCandidate {
  return {
    productId: 'p1',
    ci: '12345',
    reference: '0221504470',
    oemCodes: [],
    categoryIds: ['bobinas'],
    ...overrides,
  }
}

describe('findExactReferenceMatches', () => {
  it('matches by CI with maximum priority, even without a reference match', () => {
    const results = findExactReferenceMatches(
      { ci: '12345', referenceCodes: [], oemCodes: [] },
      [candidate({ reference: null })],
      null,
    )
    expect(results).toEqual([{ productId: 'p1', matchedField: 'ci' }])
  })

  it('matches by a normalized reference code', () => {
    const results = findExactReferenceMatches(
      { ci: null, referenceCodes: ['0221-504470'], oemCodes: [] },
      [candidate()],
      null,
    )
    expect(results).toEqual([{ productId: 'p1', matchedField: 'reference' }])
  })

  it('matches by a detected OEM code', () => {
    const results = findExactReferenceMatches(
      { ci: null, referenceCodes: [], oemCodes: ['XY9988'] },
      [candidate({ reference: null, oemCodes: ['XY-9988'] })],
      null,
    )
    expect(results).toEqual([{ productId: 'p1', matchedField: 'oem' }])
  })

  it('excludes a candidate outside the allowed category scope, even with a matching reference', () => {
    const results = findExactReferenceMatches(
      { ci: null, referenceCodes: ['0221504470'], oemCodes: [] },
      [candidate({ categoryIds: ['filtros'] })],
      ['bobinas'],
    )
    expect(results).toEqual([])
  })

  it('includes a candidate that belongs to the allowed scope', () => {
    const results = findExactReferenceMatches(
      { ci: null, referenceCodes: ['0221504470'], oemCodes: [] },
      [candidate({ categoryIds: ['bobinas', 'encendido'] })],
      ['bobinas'],
    )
    expect(results).toHaveLength(1)
  })

  it('never produces a partial/dangerous match on a short numeric code', () => {
    const results = findExactReferenceMatches(
      { ci: null, referenceCodes: ['12'], oemCodes: [] },
      [candidate({ reference: '12000' })],
      null,
    )
    expect(results).toEqual([])
  })

  it('returns no matches when nothing lines up', () => {
    const results = findExactReferenceMatches(
      { ci: '999', referenceCodes: ['ABCDEF'], oemCodes: [] },
      [candidate()],
      null,
    )
    expect(results).toEqual([])
  })
})
