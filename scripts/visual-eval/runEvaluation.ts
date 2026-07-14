// Runs an evaluation manifest against the deployed visual-product-search
// Edge Function over plain HTTP (same multipart contract the frontend uses),
// and reduces the responses into an EvaluationReport (spec sections 7/29).
//
// Not covered by the unit test suite — it performs real network I/O against
// a deployed Supabase project. metrics.ts (the actual scoring logic) is
// unit-tested; this module is the thin I/O glue around it.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { computeEvaluationMetrics } from './metrics.ts'
import type { EvaluationCaseResult, EvaluationManifest, EvaluationReport, VisualSearchEvaluationCase } from './types.ts'

export interface RunEvaluationOptions {
  /** e.g. https://<project-ref>.supabase.co/functions/v1 */
  functionsBaseUrl: string
  /** Supabase anon/publishable key — required by the gateway even though
   * visual-product-search itself doesn't verify a JWT. */
  anonKey: string
  /** Matches FUNCTION_SECRET on the Edge Function, if configured. */
  functionSecret?: string
}

interface VisualSearchApiResult {
  productId: string
}
interface VisualSearchApiResponse {
  error?: boolean
  message?: string
  results?: VisualSearchApiResult[]
  meta?: { usedOpenAi?: boolean; cacheHit?: boolean }
}

async function runOneCase(
  evaluationCase: VisualSearchEvaluationCase,
  options: RunEvaluationOptions,
): Promise<EvaluationCaseResult> {
  const imageBytes = readFileSync(evaluationCase.queryImagePath)
  const form = new FormData()
  form.append('image', new Blob([imageBytes]), basename(evaluationCase.queryImagePath))
  form.append('categoryId', evaluationCase.categoryId ?? '')

  const headers: Record<string, string> = {
    apikey: options.anonKey,
    Authorization: `Bearer ${options.anonKey}`,
  }
  if (options.functionSecret) headers['x-internal-secret'] = options.functionSecret

  const startedAt = Date.now()
  let response: Response
  try {
    response = await fetch(`${options.functionsBaseUrl}/visual-product-search`, {
      method: 'POST',
      headers,
      body: form,
    })
  } catch (err) {
    return {
      case: evaluationCase,
      rank: null,
      latencyMs: Date.now() - startedAt,
      usedOpenAi: false,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : 'network error',
    }
  }
  const latencyMs = Date.now() - startedAt

  if (!response.ok) {
    return { case: evaluationCase, rank: null, latencyMs, usedOpenAi: false, cacheHit: false, errorMessage: `HTTP ${response.status}` }
  }

  const data = (await response.json()) as VisualSearchApiResponse
  if (data.error) {
    return { case: evaluationCase, rank: null, latencyMs, usedOpenAi: false, cacheHit: false, errorMessage: data.message }
  }

  const results = data.results ?? []
  const index = results.findIndex((r) => r.productId === evaluationCase.expectedProductId)

  return {
    case: evaluationCase,
    rank: index === -1 ? null : index + 1,
    latencyMs,
    usedOpenAi: Boolean(data.meta?.usedOpenAi),
    cacheHit: Boolean(data.meta?.cacheHit),
  }
}

export async function runEvaluation(
  manifest: EvaluationManifest,
  options: RunEvaluationOptions,
): Promise<EvaluationReport> {
  const caseResults: EvaluationCaseResult[] = []
  for (const evaluationCase of manifest.cases) {
    // Sequential, not parallel: this hits a real deployed search endpoint —
    // running cases in parallel would distort latency measurements and
    // could trip the endpoint's own rate limiting.
    caseResults.push(await runOneCase(evaluationCase, options))
  }

  return {
    label: manifest.label,
    generatedAt: new Date().toISOString(),
    metrics: computeEvaluationMetrics(caseResults),
    caseResults,
  }
}
