import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Structural regression guard (spec sections 10/24): the pixel-embedding
// indexing path must never depend on the OpenAI client, at the source level
// — not just "doesn't call it at runtime". If a future change ever imports
// openaiClient.ts into the indexing path, this test fails immediately.
function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8')
}

describe('pixel-embedding indexing path never imports the OpenAI client', () => {
  it('visualEmbeddingJobProcessor.ts does not import openaiClient', () => {
    expect(readSource('./visualEmbeddingJobProcessor.ts')).not.toMatch(/from ['"].*openaiClient/)
  })

  it('supabaseVisualEmbeddingPort.ts does not import openaiClient', () => {
    expect(readSource('./supabaseVisualEmbeddingPort.ts')).not.toMatch(/from ['"].*openaiClient/)
  })

  it('visualEmbeddingClient.ts (the pixel-embedding HTTP client) does not import openaiClient', () => {
    expect(readSource('./visualEmbeddingClient.ts')).not.toMatch(/from ['"].*openaiClient/)
  })

  it('the worker Edge Function does not import openaiClient', () => {
    expect(readSource('../visual-embedding-worker/index.ts')).not.toMatch(/from ['"].*openaiClient/)
  })

  it('the backfill Edge Function does not import openaiClient', () => {
    expect(readSource('../backfill-visual-embeddings/index.ts')).not.toMatch(/from ['"].*openaiClient/)
  })
})
