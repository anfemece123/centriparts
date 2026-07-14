import { describe, expect, it, vi } from 'vitest'
import { indexProductImage, type IndexImagePort, type UpsertFeatureInput } from './indexImage.ts'
import { ANALYSIS_VERSION, loadConfig } from './config.ts'
import type { OpenAIClient } from './openaiClient.ts'

const config = loadConfig(() => undefined)

function makeOpenAIClient(): OpenAIClient {
  return {
    analyzeImage: async () => ({
      json: {
        isAutomotivePart: true,
        imageQuality: 'good',
        viewAngle: null,
        partType: 'Bobina',
        categoryGuess: null,
        brandVisible: null,
        manufacturerVisible: null,
        referenceCodes: ['ABC123'],
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
        searchDescription: 'bobina de encendido',
        warnings: [],
      },
      usage: undefined,
    }),
    rerank: async () => ({ json: { candidates: [] }, usage: undefined }),
    createEmbedding: async () => [0.1, 0.2, 0.3],
  }
}

function makePort(overrides: Partial<IndexImagePort> = {}): IndexImagePort {
  const upsertFeature = vi.fn(async (_input: UpsertFeatureInput) => {})
  return {
    getProductImage: async (id) => ({ id, product_id: 'prod-1', storage_path: `prod-1/${id}.jpg` }),
    getProductForIndexing: async (id) => ({
      id,
      ci: '999',
      base_name: 'Bobina',
      display_name: null,
      reference: null,
      brandName: null,
      typeName: null,
      categoryPaths: [],
      compatibilitySummary: [],
    }),
    downloadImageBytes: async () => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }),
    getExistingFeature: async () => null,
    upsertFeature,
    ...overrides,
  }
}

describe('indexProductImage', () => {
  it('returns failed when the product image does not exist', async () => {
    const port = makePort({ getProductImage: async () => null })
    const result = await indexProductImage(port, makeOpenAIClient(), config, 'missing-image')
    expect(result).toEqual({ productImageId: 'missing-image', status: 'failed', reason: 'not_found' })
  })

  it('skips re-analysis when a completed row already matches the current image hash', async () => {
    // sha256 of bytes [1,2,3] — precomputed so the "existing" row matches.
    const existingHash = '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81'
    const port = makePort({
      getExistingFeature: async () => ({
        status: 'completed',
        image_sha256: existingHash,
        updated_at: new Date().toISOString(),
      }),
    })
    const openaiClient = makeOpenAIClient()
    const analyzeSpy = vi.spyOn(openaiClient, 'analyzeImage')

    const result = await indexProductImage(port, openaiClient, config, 'img-1')

    expect(result.status).toBe('skipped')
    expect(analyzeSpy).not.toHaveBeenCalled()
  })

  it('re-analyzes when the existing row is for a different image hash', async () => {
    const port = makePort({
      getExistingFeature: async () => ({
        status: 'completed',
        image_sha256: 'stale-hash',
        updated_at: new Date().toISOString(),
      }),
    })
    const openaiClient = makeOpenAIClient()
    const analyzeSpy = vi.spyOn(openaiClient, 'analyzeImage')

    const result = await indexProductImage(port, openaiClient, config, 'img-1')

    expect(result.status).toBe('completed')
    expect(analyzeSpy).toHaveBeenCalledTimes(1)
  })

  it('skips (without calling OpenAI) when another run claimed the image recently', async () => {
    const port = makePort({
      getExistingFeature: async () => ({
        status: 'processing',
        image_sha256: 'irrelevant',
        updated_at: new Date(Date.now() - 5_000).toISOString(), // 5s ago — fresh
      }),
    })
    const openaiClient = makeOpenAIClient()
    const analyzeSpy = vi.spyOn(openaiClient, 'analyzeImage')

    const result = await indexProductImage(port, openaiClient, config, 'img-1')

    expect(result).toEqual({ productImageId: 'img-1', status: 'skipped', reason: 'already_processing' })
    expect(analyzeSpy).not.toHaveBeenCalled()
  })

  it('reclaims a stuck "processing" row past the staleness window (crashed run)', async () => {
    const port = makePort({
      getExistingFeature: async () => ({
        status: 'processing',
        image_sha256: 'irrelevant',
        updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago — stale
      }),
    })
    const openaiClient = makeOpenAIClient()
    const analyzeSpy = vi.spyOn(openaiClient, 'analyzeImage')

    const result = await indexProductImage(port, openaiClient, config, 'img-1')

    expect(result.status).toBe('completed')
    expect(analyzeSpy).toHaveBeenCalledTimes(1)
  })

  it('persists a completed row with the analysis version and embedding on success', async () => {
    const upsertFeature = vi.fn(async () => {})
    const port = makePort({ upsertFeature })

    await indexProductImage(port, makeOpenAIClient(), config, 'img-1')

    const completedCall = upsertFeature.mock.calls.find(([input]) => input.status === 'completed')
    expect(completedCall).toBeTruthy()
    expect(completedCall![0].analysisVersion).toBe(ANALYSIS_VERSION)
    expect(completedCall![0].embedding).toEqual([0.1, 0.2, 0.3])
  })

  it('marks the row failed (with a sanitized message) when OpenAI analysis throws', async () => {
    const upsertFeature = vi.fn(async () => {})
    const port = makePort({ upsertFeature })
    const openaiClient = makeOpenAIClient()
    openaiClient.analyzeImage = async () => {
      throw new Error('OpenAI respondió con estado 500')
    }

    const result = await indexProductImage(port, openaiClient, config, 'img-1')

    expect(result.status).toBe('failed')
    const failedCall = upsertFeature.mock.calls.find(([input]) => input.status === 'failed')
    expect(failedCall).toBeTruthy()
    expect(failedCall![0].errorMessage).toContain('500')
  })

  it('increments attempt_count via attemptIncrement on every real attempt', async () => {
    const upsertFeature = vi.fn(async () => {})
    const port = makePort({ upsertFeature })

    await indexProductImage(port, makeOpenAIClient(), config, 'img-1')

    const processingCall = upsertFeature.mock.calls.find(([input]) => input.status === 'processing')
    expect(processingCall![0].attemptIncrement).toBe(true)
  })
})
