import { describe, expect, it } from 'vitest'
import { parseCompatibilityText } from './compatibility-parser'

describe('compatibility year ranges', () => {
  it('normalizes slash-separated ranges exported newest-first', () => {
    const [result] = parseCompatibilityText('CHEVROLET AVEO 07/02', 'CHEVROLET')

    expect(result).toMatchObject({
      vehicleModelName: 'AVEO',
      yearFrom: 2002,
      yearTo: 2007,
    })
  })

  it('keeps descending hyphenated model numbers as model nomenclature', () => {
    const [result] = parseCompatibilityText('RENAULT 21-19-11-CLIO', 'RENAULT')

    expect(result.yearFrom).toBeNull()
    expect(result.yearTo).toBeNull()
    expect(result.vehicleModelName).toContain('21-19-11')
  })

  it('does not interpret four-digit vehicle models as years', () => {
    const [result] = parseCompatibilityText('PEUGEOT 1007-206-307', 'PEUGEOT')

    expect(result.yearFrom).toBeNull()
    expect(result.yearTo).toBeNull()
    expect(result.vehicleModelName).toContain('1007')
  })
})
