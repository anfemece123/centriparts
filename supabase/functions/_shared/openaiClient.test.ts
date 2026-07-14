import { describe, expect, it, vi } from 'vitest'
import { createOpenAIClient, OpenAIRequestError } from './openaiClient.ts'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('createOpenAIClient — retries and error handling', () => {
  it('retries once on a 429 and succeeds on the second attempt', async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      if (calls === 1) return new Response('rate limited', { status: 429 })
      return jsonResponse({ data: [{ embedding: [0.1, 0.2] }] })
    })

    const client = createOpenAIClient({ apiKey: 'test-key', fetchImpl, maxRetries: 2, timeoutMs: 1000 })
    const embedding = await client.createEmbedding({ model: 'text-embedding-3-large', input: 'hola', dimensions: 2 })

    expect(embedding).toEqual([0.1, 0.2])
    expect(calls).toBe(2)
  })

  it('retries on 5xx errors', async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      if (calls < 3) return new Response('boom', { status: 503 })
      return jsonResponse({ data: [{ embedding: [1] }] })
    })

    const client = createOpenAIClient({ apiKey: 'k', fetchImpl, maxRetries: 3, timeoutMs: 1000 })
    await client.createEmbedding({ model: 'm', input: 'x', dimensions: 1 })
    expect(calls).toBe(3)
  })

  it('does not retry a 400 (client error) and surfaces it immediately', async () => {
    const fetchImpl = vi.fn(async () => new Response('bad request', { status: 400 }))
    const client = createOpenAIClient({ apiKey: 'k', fetchImpl, maxRetries: 3, timeoutMs: 1000 })

    await expect(client.createEmbedding({ model: 'm', input: 'x', dimensions: 1 })).rejects.toThrow(OpenAIRequestError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('gives up after exhausting retries and throws the last error', async () => {
    const fetchImpl = vi.fn(async () => new Response('down', { status: 500 }))
    const client = createOpenAIClient({ apiKey: 'k', fetchImpl, maxRetries: 2, timeoutMs: 1000 })

    await expect(client.createEmbedding({ model: 'm', input: 'x', dimensions: 1 })).rejects.toThrow(OpenAIRequestError)
    expect(fetchImpl).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
  })

  it('never leaks the API key or response body into the thrown error', async () => {
    const fetchImpl = vi.fn(async () => new Response('secret-detail leaked-key-xyz', { status: 500 }))
    const client = createOpenAIClient({ apiKey: 'super-secret-key', fetchImpl, maxRetries: 0, timeoutMs: 1000 })

    try {
      await client.createEmbedding({ model: 'm', input: 'x', dimensions: 1 })
      expect.unreachable()
    } catch (err) {
      const message = (err as Error).message
      expect(message).not.toContain('super-secret-key')
      expect(message).not.toContain('leaked-key-xyz')
    }
  })
})
