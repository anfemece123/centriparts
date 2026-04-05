import { useEffect, useState } from 'react'
import { PageHeader, Card, Badge, Button } from '@/shared/components/ui'
import { analyzeProductNames } from '@/modules/catalog/services/name-parser'
import { runCategoryAssignment } from '@/modules/catalog/services/category-assignment.service'
import type { NameAnalysisRow, NameConfidence } from '@/modules/catalog/services/name-parser'
import type { AssignmentReport } from '@/modules/catalog/services/category-assignment.service'

const PAGE_SIZE = 100

const CONFIDENCE_LABEL: Record<NameConfidence, string> = {
  clear:     'Claro',
  ambiguous: 'Ambiguo',
}

const CONFIDENCE_BADGE: Record<NameConfidence, 'success' | 'warning'> = {
  clear:     'success',
  ambiguous: 'warning',
}

type FilterOption = 'all' | NameConfidence

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'all',       label: 'Todos' },
  { value: 'clear',     label: 'Claros' },
  { value: 'ambiguous', label: 'Ambiguos' },
]

function shortId(id: string) {
  return id.substring(0, 8) + '…'
}

export default function NameAnalysisPage() {
  const [rows, setRows]       = useState<NameAnalysisRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const [filter, setFilter] = useState<FilterOption>('all')
  const [page, setPage]     = useState(1)

  const [running, setRunning]         = useState(false)
  const [report, setReport]           = useState<AssignmentReport | null>(null)
  const [runError, setRunError]       = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    analyzeProductNames()
      .then(setRows)
      .catch(() => setError('No se pudo cargar el análisis. Verifique la conexión.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { setPage(1) }, [filter])

  const filtered   = filter === 'all' ? rows : rows.filter((r) => r.confidence === filter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart  = (page - 1) * PAGE_SIZE
  const visible    = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  const total     = rows.length
  const clear     = rows.filter((r) => r.confidence === 'clear').length
  const ambiguous = rows.filter((r) => r.confidence === 'ambiguous').length

  const uniqueCategories = [...new Set(rows.map((r) => r.detected_category).filter(Boolean))].sort() as string[]
  const uniqueSubs       = [...new Set(rows.map((r) => r.detected_subcategory).filter(Boolean))].sort() as string[]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Análisis de nombres de productos"
        description="Lectura únicamente — no se modifica ningún dato."
      />

      {loading ? (
        <p className="py-16 text-center text-sm text-zinc-400">Analizando productos…</p>
      ) : error ? (
        <p className="py-16 text-center text-sm text-red-500">{error}</p>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <SummaryCard label="Total analizado" value={total} />
            <SummaryCard label="Claros" value={clear} color="text-green-600" />
            <SummaryCard label="Ambiguos" value={ambiguous} color="text-yellow-600" />
          </div>

          {/* Unique values */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Categorías principales detectadas ({uniqueCategories.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {uniqueCategories.map((c) => (
                  <span key={c} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                    {c}
                  </span>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Subcategorías detectadas ({uniqueSubs.length})
              </h3>
              <div className="max-h-32 overflow-y-auto flex flex-wrap gap-2">
                {uniqueSubs.map((s) => (
                  <span key={s} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                    {s}
                  </span>
                ))}
              </div>
            </Card>
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((opt) => {
              const count =
                opt.value === 'all' ? total :
                opt.value === 'clear' ? clear : ambiguous
              return (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={[
                    'rounded-md border px-4 py-1.5 text-sm font-medium transition-colors',
                    filter === opt.value
                      ? 'border-yellow-400 bg-yellow-400 text-black'
                      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50',
                  ].join(' ')}
                >
                  {opt.label} ({count})
                </button>
              )
            })}
          </div>

          {/* Table */}
          <Card padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Nombre original</th>
                    <th className="px-4 py-3">Categoría principal</th>
                    <th className="px-4 py-3">Subcategoría</th>
                    <th className="px-4 py-3">Confianza</th>
                    <th className="px-4 py-3">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {visible.map((row) => (
                    <tr
                      key={row.id}
                      className={row.confidence === 'ambiguous' ? 'bg-yellow-50' : ''}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">
                        {shortId(row.id)}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-zinc-900">
                        {row.base_name}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-zinc-800">
                        {row.detected_category ?? <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600">
                        {row.detected_subcategory ?? <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          label={CONFIDENCE_LABEL[row.confidence]}
                          variant={CONFIDENCE_BADGE[row.confidence]}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-400">
                        {row.note ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-zinc-500">
              <span>
                Mostrando {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} de {filtered.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="tabular-nums">Página {page} de {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {/* Assignment */}
          <Card>
            <h3 className="mb-1 text-sm font-semibold text-zinc-700">Aplicar asignaciones</h3>
            <p className="mb-4 text-sm text-zinc-500">
              Crea las categorías detectadas y asigna cada producto a su categoría principal.
              Es seguro ejecutar varias veces — usa upserts, no elimina datos existentes.
            </p>

            <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              Esto sobreescribirá la categoría primaria de todos los productos procesados.
              Las asignaciones manuales previas con <code className="text-xs">is_primary = true</code> serán reemplazadas.
              Las demás asignaciones de categoría no se eliminarán.
            </div>

            <div className="flex items-center gap-4">
              <Button
                onClick={async () => {
                  setRunning(true)
                  setRunError(null)
                  setReport(null)
                  try {
                    const result = await runCategoryAssignment()
                    setReport(result)
                  } catch {
                    setRunError('Error al ejecutar la asignación. Verifique la consola.')
                  } finally {
                    setRunning(false)
                  }
                }}
                disabled={running}
              >
                {running ? 'Ejecutando…' : 'Ejecutar asignación'}
              </Button>
              {runError && <span className="text-sm text-red-500">{runError}</span>}
            </div>

            {report && (
              <div className="mt-6 flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Resultado</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 text-sm">
                  <ReportStat label="Productos procesados" value={report.totalProducts} />
                  <ReportStat label="Omitidos (sin nombre)" value={report.skipped} />
                  <ReportStat label="Categorías principales" value={report.mainCategoriesCreated} />
                  <ReportStat label="Subcategorías" value={report.subcategoriesCreated} />
                  <ReportStat label="Productos asignados" value={report.productsAssigned} color="text-green-600" />
                  <ReportStat label="Errores" value={report.errors.length} color={report.errors.length > 0 ? 'text-red-600' : undefined} />
                </div>
                {report.errors.length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-500">Errores</p>
                    <ul className="flex flex-col gap-1">
                      {report.errors.map((e, i) => (
                        <li key={i} className="text-xs text-red-700">{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color = 'text-zinc-900',
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${color}`}>{value.toLocaleString('es-CO')}</p>
    </Card>
  )
}

function ReportStat({
  label,
  value,
  color = 'text-zinc-800',
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value.toLocaleString('es-CO')}</p>
    </div>
  )
}
