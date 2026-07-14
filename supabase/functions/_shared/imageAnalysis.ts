import type { OpenAIClient } from './openaiClient.ts'
import { isAutomotivePartImageAnalysis } from './validation.ts'
import type { AutomotivePartImageAnalysis } from './types.ts'
import { ANALYSIS_JSON_SCHEMA, buildAnalysisInstructions } from './prompts.ts'

export class InvalidAnalysisResponseError extends Error {}

export interface AnalyzeAutomotivePartImageParams {
  imageDataUrl: string
  model: string
  /** Short label like "Bobinas" — used only as context, never enforced. */
  categoryContext?: string | null
}

export async function analyzeAutomotivePartImage(
  client: OpenAIClient,
  params: AnalyzeAutomotivePartImageParams,
): Promise<AutomotivePartImageAnalysis> {
  const { json } = await client.analyzeImage({
    model: params.model,
    instructions: buildAnalysisInstructions(params.categoryContext ?? null),
    imageDataUrl: params.imageDataUrl,
    schemaName: 'automotive_part_image_analysis',
    schema: ANALYSIS_JSON_SCHEMA,
    detail: 'high',
  })

  if (!isAutomotivePartImageAnalysis(json)) {
    throw new InvalidAnalysisResponseError('OpenAI devolvió un análisis con formato inválido.')
  }

  return json
}
