import { describe, expect, it } from 'vitest'
import { findVectorCandidates, type VectorSearchPort } from './vectorSearch.ts'

describe('findVectorCandidates', () => {
  it('reshapes RPC rows into camelCase candidates', async () => {
    const port: VectorSearchPort = {
      matchByEmbedding: async () => [
        { product_id: 'p1', product_image_id: 'i1', storage_path: 'p1/a.jpg', similarity: 0.91 },
      ],
    }
    const result = await findVectorCandidates(
      { queryEmbedding: [0.1], categoryIds: null, matchCount: 10, minimumSimilarity: 0 },
      port,
    )
    expect(result).toEqual([
      { productId: 'p1', productImageId: 'i1', storagePath: 'p1/a.jpg', similarity: 0.91 },
    ])
  })

  it('already returns one row per product — the RPC groups by product with DISTINCT ON', async () => {
    // This documents the contract: the RPC (match_product_images_by_embedding
    // in the migration) is responsible for keeping only the best image per
    // product via `DISTINCT ON (f.product_id) ... ORDER BY ... similarity`.
    // This function must not need to re-group anything.
    const rows = [
      { product_id: 'p1', product_image_id: 'i1', storage_path: 'p1/a.jpg', similarity: 0.9 },
      { product_id: 'p2', product_image_id: 'i2', storage_path: 'p2/a.jpg', similarity: 0.8 },
    ]
    const port: VectorSearchPort = { matchByEmbedding: async () => rows }
    const result = await findVectorCandidates(
      { queryEmbedding: [0.1], categoryIds: null, matchCount: 10, minimumSimilarity: 0 },
      port,
    )
    const productIds = result.map((r) => r.productId)
    expect(new Set(productIds).size).toBe(productIds.length)
  })

  it('returns an empty array when nothing is indexed in scope', async () => {
    const port: VectorSearchPort = { matchByEmbedding: async () => [] }
    const result = await findVectorCandidates(
      { queryEmbedding: [0.1], categoryIds: ['bobinas'], matchCount: 10, minimumSimilarity: 0 },
      port,
    )
    expect(result).toEqual([])
  })
})
