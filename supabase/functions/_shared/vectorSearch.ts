export interface VectorMatchRow {
  product_id: string
  product_image_id: string
  storage_path: string
  similarity: number
}

export interface VectorSearchParams {
  queryEmbedding: number[]
  /** null => global search; array => restricted to these category ids. */
  categoryIds: string[] | null
  matchCount: number
  minimumSimilarity: number
}

export interface VectorSearchPort {
  matchByEmbedding(params: VectorSearchParams): Promise<VectorMatchRow[]>
}

export interface VectorCandidate {
  productId: string
  productImageId: string
  storagePath: string
  similarity: number
}

/**
 * Thin, testable wrapper around the `match_product_images_by_embedding` RPC.
 * The RPC itself already filters by category and keeps one row per product
 * (best image) — this function only reshapes the result for the pipeline.
 */
export async function findVectorCandidates(
  params: VectorSearchParams,
  port: VectorSearchPort,
): Promise<VectorCandidate[]> {
  const rows = await port.matchByEmbedding(params)
  return rows.map((row) => ({
    productId: row.product_id,
    productImageId: row.product_image_id,
    storagePath: row.storage_path,
    similarity: row.similarity,
  }))
}
