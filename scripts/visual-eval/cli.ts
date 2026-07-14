#!/usr/bin/env node
// CLI entrypoint for the evaluation harness (spec sections 7/29).
// Run with: node --experimental-strip-types scripts/visual-eval/cli.ts <command> ...
// (Node 22 supports running .ts files directly via type stripping — no
// extra dev dependency like ts-node/tsx needed.)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { buildComparisonMarkdown } from './compareReports.ts'
import { runEvaluation } from './runEvaluation.ts'
import type { EvaluationManifest, EvaluationReport } from './types.ts'

function ensureDirFor(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
}

function printUsage(): void {
  console.log(`Uso:
  node --experimental-strip-types scripts/visual-eval/cli.ts init-manifest [outPath]
  node --experimental-strip-types scripts/visual-eval/cli.ts run <manifest.json> [outPath]
  node --experimental-strip-types scripts/visual-eval/cli.ts compare <report1.json> [report2.json ...]

Variables de entorno requeridas para "run":
  SUPABASE_FUNCTIONS_URL   — p.ej. https://<project-ref>.supabase.co/functions/v1
  SUPABASE_ANON_KEY        — clave anon/publishable del proyecto
  VISUAL_SEARCH_FUNCTION_SECRET (opcional) — igual a FUNCTION_SECRET del backend
`)
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv

  if (command === 'init-manifest') {
    const outPath = args[0] ?? 'scripts/visual-eval/manifest.example.json'
    const template: EvaluationManifest = {
      label: 'dinov2-small-v1',
      cases: [
        {
          queryImagePath: 'scripts/visual-eval/photos/example-1.jpg',
          expectedProductId: 'REPLACE_WITH_REAL_PRODUCT_ID',
          categoryId: null,
          notes: 'Foto limpia, fondo blanco, referencia visible',
        },
        {
          queryImagePath: 'scripts/visual-eval/photos/example-2.jpg',
          expectedProductId: 'REPLACE_WITH_REAL_PRODUCT_ID',
          categoryId: null,
          notes: 'Foto usada/sucia, otro ángulo, sin referencia visible',
        },
      ],
    }
    ensureDirFor(outPath)
    writeFileSync(outPath, JSON.stringify(template, null, 2))
    console.log(`Plantilla creada en ${outPath}.`)
    console.log('Reemplaza las rutas de fotos reales y los product_id reales antes de correr "run".')
    return
  }

  if (command === 'run') {
    const manifestPath = args[0]
    if (!manifestPath) {
      printUsage()
      process.exitCode = 1
      return
    }
    const outPath = args[1] ?? `scripts/visual-eval/reports/${Date.now()}.json`

    const functionsBaseUrl = process.env.SUPABASE_FUNCTIONS_URL
    const anonKey = process.env.SUPABASE_ANON_KEY
    const functionSecret = process.env.VISUAL_SEARCH_FUNCTION_SECRET

    if (!functionsBaseUrl || !anonKey) {
      console.error('Faltan las variables de entorno SUPABASE_FUNCTIONS_URL y/o SUPABASE_ANON_KEY.')
      process.exitCode = 1
      return
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as EvaluationManifest
    const report = await runEvaluation(manifest, { functionsBaseUrl, anonKey, functionSecret })

    ensureDirFor(outPath)
    writeFileSync(outPath, JSON.stringify(report, null, 2))
    console.log(`Reporte guardado en ${outPath}`)
    console.log(JSON.stringify(report.metrics, null, 2))
    return
  }

  if (command === 'compare') {
    if (args.length === 0) {
      printUsage()
      process.exitCode = 1
      return
    }
    const reports = args.map((path) => JSON.parse(readFileSync(path, 'utf-8')) as EvaluationReport)
    console.log(buildComparisonMarkdown(reports))
    return
  }

  printUsage()
  process.exitCode = command ? 1 : 0
}

main()
