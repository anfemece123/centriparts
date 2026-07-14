import { describe, expect, it, vi } from 'vitest'
import { rerankVisualCandidates, InvalidRerankResponseError } from './rerank.ts'
import type { OpenAIClient } from './openaiClient.ts'

function clientReturning(json: unknown): OpenAIClient {
  return {
    analyzeImage: async () => ({ json: {}, usage: undefined }),
    rerank: async () => ({ json, usage: undefined }),
    createEmbedding: async () => [0],
  }
}

const candidateInput = {
  productId: 'p1',
  ci: '123',
  brand: 'Bosch',
  type: null,
  referenceCodes: [],
  distinctiveFeatures: [],
  imageDataUrl: 'data:image/jpeg;base64,AAA',
}

describe('rerankVisualCandidates', () => {
  it('returns an empty array without calling OpenAI when there are no candidates', async () => {
    const client = clientReturning({ candidates: [] })
    const rerankSpy = vi.spyOn(client, 'rerank')
    const result = await rerankVisualCandidates(client, {
      model: 'gpt-4.1-mini',
      queryImageDataUrl: 'data:image/jpeg;base64,AAA',
      candidates: [],
    })
    expect(result).toEqual([])
    expect(rerankSpy).not.toHaveBeenCalled()
  })

  it('makes a single OpenAI call for the whole batch of candidates', async () => {
    const client = clientReturning({
      candidates: [
        {
          product_id: 'p1',
          verdict: 'probable',
          confidence: 0.7,
          decisive_matches: [],
          contradictions: [],
          reference_match: false,
          brand_match: true,
          shape_match: true,
          connector_match: true,
          mounting_match: false,
          visible_text_match: false,
        },
      ],
    })
    const rerankSpy = vi.spyOn(client, 'rerank')
    const result = await rerankVisualCandidates(client, {
      model: 'gpt-4.1-mini',
      queryImageDataUrl: 'data:image/jpeg;base64,AAA',
      candidates: [candidateInput, { ...candidateInput, productId: 'p2' }],
    })
    expect(result).toHaveLength(1)
    expect(rerankSpy).toHaveBeenCalledTimes(1)
  })

  it('throws InvalidRerankResponseError on a malformed response', async () => {
    const client = clientReturning({ candidates: [{ product_id: 'p1' }] })
    await expect(
      rerankVisualCandidates(client, {
        model: 'gpt-4.1-mini',
        queryImageDataUrl: 'data:image/jpeg;base64,AAA',
        candidates: [candidateInput],
      }),
    ).rejects.toThrow(InvalidRerankResponseError)
  })
})
