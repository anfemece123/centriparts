import { describe, expect, it } from 'vitest'
import { groupVisualMatchesByProduct } from './visualGrouping.ts'
import type { RawVisualMatch } from './visualSearchTypes.ts'

function match(productId: string, productImageId: string, similarity: number): RawVisualMatch {
  return { productId, productImageId, similarity }
}

describe('groupVisualMatchesByProduct', () => {
  it('collapses several matching images of the same product into one card', () => {
    const grouped = groupVisualMatchesByProduct([
      match('p1', 'img-a', 0.9),
      match('p1', 'img-b', 0.8),
      match('p1', 'img-c', 0.7),
    ])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].productId).toBe('p1')
  })

  it('keeps the highest-similarity image as the matched image', () => {
    const grouped = groupVisualMatchesByProduct([
      match('p1', 'img-low', 0.5),
      match('p1', 'img-high', 0.95),
    ])
    expect(grouped[0].bestProductImageId).toBe('img-high')
    expect(grouped[0].bestSimilarity).toBe(0.95)
  })

  it('caps the consensus bonus even with many extra matching images', () => {
    const many = Array.from({ length: 20 }, (_, i) => match('p1', `img-${i}`, 0.9 - i * 0.001))
    const grouped = groupVisualMatchesByProduct(many)
    expect(grouped[0].consensusBonus).toBe(0.025)
  })

  it('gives zero consensus bonus to a product with only one matching image', () => {
    const grouped = groupVisualMatchesByProduct([match('p1', 'img-a', 0.9)])
    expect(grouped[0].consensusBonus).toBe(0)
  })

  it('grows the consensus bonus by 0.005 per additional useful image below the cap', () => {
    const grouped = groupVisualMatchesByProduct([
      match('p1', 'img-a', 0.9),
      match('p1', 'img-b', 0.8),
      match('p1', 'img-c', 0.7),
    ])
    expect(grouped[0].consensusBonus).toBeCloseTo(0.01, 5) // 2 extra images * 0.005
  })

  it('does not let a product with 9 images automatically outrank a single strong match from another product', () => {
    const nineImages = Array.from({ length: 9 }, (_, i) => match('p-many-images', `img-${i}`, 0.5))
    const oneStrongImage = [match('p-one-image', 'img-x', 0.98)]
    const grouped = groupVisualMatchesByProduct([...nineImages, ...oneStrongImage])
    // Even with the max consensus bonus (0.025), 0.5 + 0.025 cannot beat 0.98.
    expect(grouped[0].productId).toBe('p-one-image')
  })

  it('never produces two cards for the same product', () => {
    const grouped = groupVisualMatchesByProduct([
      match('p1', 'img-a', 0.9),
      match('p2', 'img-b', 0.8),
      match('p1', 'img-c', 0.7),
      match('p2', 'img-d', 0.6),
    ])
    const productIds = grouped.map((g) => g.productId)
    expect(new Set(productIds).size).toBe(productIds.length)
  })

  it('sorts groups by best similarity descending', () => {
    const grouped = groupVisualMatchesByProduct([
      match('p-low', 'img-a', 0.4),
      match('p-high', 'img-b', 0.9),
      match('p-mid', 'img-c', 0.6),
    ])
    expect(grouped.map((g) => g.productId)).toEqual(['p-high', 'p-mid', 'p-low'])
  })

  it('returns an empty array for no matches', () => {
    expect(groupVisualMatchesByProduct([])).toEqual([])
  })
})
