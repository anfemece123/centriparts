import { describe, expect, it } from 'vitest'
import { buildComparisonMarkdown } from './compareReports.ts'
import type { EvaluationReport } from './types.ts'

function makeReport(overrides: Partial<EvaluationReport> = {}): EvaluationReport {
  return {
    label: 'dinov2-small-v1',
    generatedAt: '2026-01-01T00:00:00.000Z',
    metrics: {
      totalCases: 10,
      recallAt1: 0.8,
      recallAt3: 0.9,
      recallAt5: 0.95,
      recallAt10: 1,
      meanReciprocalRank: 0.85,
      latencyMeanMs: 400,
      latencyMedianMs: 380,
      latencyP95Ms: 600,
      percentSearchesWithoutOpenAi: 100,
    },
    caseResults: [],
    ...overrides,
  }
}

describe('buildComparisonMarkdown', () => {
  it('includes one row per report plus a header and separator', () => {
    const markdown = buildComparisonMarkdown([makeReport(), makeReport({ label: 'siglip-base-v1' })])
    const lines = markdown.split('\n')
    expect(lines).toHaveLength(4)
    expect(lines[0]).toContain('Recall@1')
    expect(lines[2]).toContain('dinov2-small-v1')
    expect(lines[3]).toContain('siglip-base-v1')
  })

  it('formats recall values as percentages', () => {
    const markdown = buildComparisonMarkdown([makeReport()])
    expect(markdown).toContain('80%')
    expect(markdown).toContain('100%')
  })

  it('produces a valid Markdown table (each row has the same column count)', () => {
    const markdown = buildComparisonMarkdown([makeReport(), makeReport({ label: 'other' })])
    const columnCounts = markdown.split('\n').map((line) => line.split('|').length)
    expect(new Set(columnCounts).size).toBe(1)
  })
})
