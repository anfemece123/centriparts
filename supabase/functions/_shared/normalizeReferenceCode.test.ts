import { describe, expect, it } from 'vitest'
import { ciMatches, normalizeCI, normalizeReferenceCode, referenceCodesMatch } from './normalizeReferenceCode.ts'

describe('normalizeCI / ciMatches', () => {
  it('trims but never uppercases or strips separators', () => {
    expect(normalizeCI('  12345  ')).toBe('12345')
    expect(normalizeCI('ab-12')).toBe('ab-12')
  })

  it('matches only exact, trimmed equality — no fuzzy tolerance', () => {
    expect(ciMatches(' 12345 ', '12345')).toBe(true)
    expect(ciMatches('12345', '12346')).toBe(false)
    expect(ciMatches('AB-12', 'ab-12')).toBe(false) // case matters for CI
    expect(ciMatches('', '')).toBe(false) // empty CI never matches
  })
})

describe('normalizeReferenceCode', () => {
  it('uppercases and strips separators while preserving the original', () => {
    const result = normalizeReferenceCode('0221-504470')
    expect(result.original).toBe('0221-504470')
    expect(result.normalized).toBe('0221504470')
    expect(result.isViable).toBe(true)
  })

  it('treats spaces, dots and slashes as separators too', () => {
    expect(normalizeReferenceCode('02 21.504/470').normalized).toBe('0221504470')
  })

  it('flags short numeric-only codes as non-viable to avoid false positives', () => {
    expect(normalizeReferenceCode('12').isViable).toBe(false)
    expect(normalizeReferenceCode('1234').isViable).toBe(false) // still numeric-only, needs 5+
    expect(normalizeReferenceCode('12345').isViable).toBe(true)
  })

  it('allows shorter alphanumeric codes since they are less ambiguous than pure numbers', () => {
    expect(normalizeReferenceCode('AB1').isViable).toBe(false) // 3 chars, below the 4-char floor
    expect(normalizeReferenceCode('AB12').isViable).toBe(true)
  })

  it('treats an empty string as non-viable', () => {
    expect(normalizeReferenceCode('   ').isViable).toBe(false)
  })
})

describe('referenceCodesMatch', () => {
  it('matches formatted variants of the same reference', () => {
    expect(referenceCodesMatch('0221-504470', '0221504470')).toBe(true)
    expect(referenceCodesMatch('0221 504 470', '0221-504-470')).toBe(true)
  })

  it('never performs a dangerous partial match', () => {
    expect(referenceCodesMatch('0221504470', '0221504470999')).toBe(false)
    expect(referenceCodesMatch('12', '12000')).toBe(false)
  })

  it('refuses to match when either side is non-viable', () => {
    expect(referenceCodesMatch('12', '12')).toBe(false) // both short numeric
    expect(referenceCodesMatch('AB12', '12')).toBe(false)
  })
})
