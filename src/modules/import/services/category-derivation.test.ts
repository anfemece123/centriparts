import { describe, expect, it } from 'vitest'
import { deriveProductCategory } from './category-derivation'

describe('inventory category derivation', () => {
  it('uses a single-word PRODUCTO value as the main category', () => {
    expect(deriveProductCategory('BOMBILLO')).toEqual({
      mainCategory: 'BOMBILLO',
      subcategory: null,
    })
  })

  it('uses the complete multi-word value as a subcategory', () => {
    expect(deriveProductCategory('  BOMBILLO   LED ')).toEqual({
      mainCategory: 'BOMBILLO',
      subcategory: 'BOMBILLO LED',
    })
  })
})
