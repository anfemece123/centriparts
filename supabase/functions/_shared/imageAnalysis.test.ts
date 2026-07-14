import { describe, expect, it } from 'vitest'
import { analyzeAutomotivePartImage, InvalidAnalysisResponseError } from './imageAnalysis.ts'
import type { OpenAIClient } from './openaiClient.ts'

function clientReturning(json: unknown): OpenAIClient {
  return {
    analyzeImage: async () => ({ json, usage: undefined }),
    rerank: async () => ({ json: { candidates: [] }, usage: undefined }),
    createEmbedding: async () => [0],
  }
}

describe('analyzeAutomotivePartImage', () => {
  it('returns the parsed analysis when OpenAI responds with a valid shape', async () => {
    const validJson = {
      isAutomotivePart: true,
      imageQuality: 'good',
      viewAngle: null,
      partType: 'Bobina',
      categoryGuess: null,
      brandVisible: null,
      manufacturerVisible: null,
      referenceCodes: [],
      oemCodes: [],
      barcodes: [],
      printedText: [],
      materials: [],
      colors: [],
      generalShape: null,
      connectorCount: null,
      connectorType: null,
      mountingPoints: [],
      holesAndThreads: [],
      distinctiveFeatures: [],
      visibleDamageOrWear: [],
      searchDescription: 'x',
      warnings: [],
    }
    const result = await analyzeAutomotivePartImage(clientReturning(validJson), {
      imageDataUrl: 'data:image/jpeg;base64,AAA',
      model: 'gpt-4.1-mini',
    })
    expect(result.partType).toBe('Bobina')
  })

  it('throws InvalidAnalysisResponseError when OpenAI returns a malformed shape', async () => {
    await expect(
      analyzeAutomotivePartImage(clientReturning({ isAutomotivePart: 'yes' }), {
        imageDataUrl: 'data:image/jpeg;base64,AAA',
        model: 'gpt-4.1-mini',
      }),
    ).rejects.toThrow(InvalidAnalysisResponseError)
  })
})
