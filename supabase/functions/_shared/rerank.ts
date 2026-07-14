import type { OpenAIClient } from './openaiClient.ts'
import { isRerankCandidateResultArray } from './validation.ts'
import type { RerankCandidateResult } from './types.ts'
import { RERANK_JSON_SCHEMA, buildRerankInstructions } from './prompts.ts'

export class InvalidRerankResponseError extends Error {}

export interface RerankCandidateInput {
  productId: string
  ci: string
  brand: string | null
  type: string | null
  referenceCodes: string[]
  distinctiveFeatures: string[]
  imageDataUrl: string
}

/**
 * Single OpenAI call comparing the query image against a small, already
 * category-scoped set of candidates (Etapa E). Never call this once per
 * candidate — the whole point is one request for the whole batch.
 */
export async function rerankVisualCandidates(
  client: OpenAIClient,
  params: { model: string; queryImageDataUrl: string; candidates: RerankCandidateInput[] },
): Promise<RerankCandidateResult[]> {
  if (params.candidates.length === 0) return []

  const { json } = await client.rerank({
    model: params.model,
    instructions: buildRerankInstructions(),
    queryImageDataUrl: params.queryImageDataUrl,
    candidateImages: params.candidates.map((candidate) => ({
      label: buildCandidateLabel(candidate),
      imageDataUrl: candidate.imageDataUrl,
    })),
    schemaName: 'visual_rerank_result',
    schema: RERANK_JSON_SCHEMA,
  })

  const payload = json as { candidates?: unknown }
  if (!isRerankCandidateResultArray(payload.candidates)) {
    throw new InvalidRerankResponseError('OpenAI devolvió una comparación con formato inválido.')
  }

  return payload.candidates
}

function buildCandidateLabel(candidate: RerankCandidateInput): string {
  const parts = [
    `Candidato product_id=${candidate.productId} (CI ${candidate.ci})`,
    candidate.brand ? `Marca: ${candidate.brand}` : null,
    candidate.type ? `Tipo: ${candidate.type}` : null,
    candidate.referenceCodes.length > 0 ? `Referencias: ${candidate.referenceCodes.join(', ')}` : null,
    candidate.distinctiveFeatures.length > 0
      ? `Características: ${candidate.distinctiveFeatures.join(', ')}`
      : null,
  ].filter((part): part is string => Boolean(part))
  return parts.join(' | ')
}
