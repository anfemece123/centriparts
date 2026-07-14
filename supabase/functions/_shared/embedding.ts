import type { OpenAIClient } from './openaiClient.ts'

export async function generateTextEmbedding(
  client: OpenAIClient,
  params: { model: string; dimensions: number; text: string },
): Promise<number[]> {
  return client.createEmbedding({ model: params.model, input: params.text, dimensions: params.dimensions })
}
