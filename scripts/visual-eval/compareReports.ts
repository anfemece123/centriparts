// Builds a comparable Markdown report across one or more evaluation runs
// (spec section 29) — e.g. one run per embedding provider (DINOv2 vs SigLIP).

import type { EvaluationReport } from './types.ts'

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`
}

export function buildComparisonMarkdown(reports: EvaluationReport[]): string {
  const header = '| Modelo | Casos | Recall@1 | Recall@3 | Recall@5 | Recall@10 | MRR | Latencia p50 | Latencia p95 | % sin OpenAI |'
  const separator = '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  const rows = reports.map((r) => {
    const m = r.metrics
    return [
      '',
      r.label,
      m.totalCases,
      pct(m.recallAt1),
      pct(m.recallAt3),
      pct(m.recallAt5),
      pct(m.recallAt10),
      m.meanReciprocalRank.toFixed(3),
      `${m.latencyMedianMs.toFixed(0)}ms`,
      `${m.latencyP95Ms.toFixed(0)}ms`,
      `${m.percentSearchesWithoutOpenAi.toFixed(0)}%`,
      '',
    ].join(' | ')
  })
  return [header, separator, ...rows].join('\n')
}
