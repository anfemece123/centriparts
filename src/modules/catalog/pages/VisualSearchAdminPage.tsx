import { useEffect, useState } from 'react'
import { PageHeader, Card, Button, Badge, SectionTitle } from '@/shared/components/ui'
import {
  getCategoryIndexingStats,
  getVisualEmbeddingCoverageStats,
} from '@/modules/catalog/services/visual-search-stats.service'
import {
  reindexCatalogImagesBatch,
  processVisualEmbeddingBatch,
  backfillVisualEmbeddings,
  retryFailedVisualEmbeddings,
} from '@/modules/catalog/services/visual-search.service'
import type {
  CategoryIndexingStat,
  ReindexBatchResult,
  VisualEmbeddingCoverageStats,
  VisualEmbeddingBackfillResult,
} from '@/types'

export default function VisualSearchAdminPage() {
  const [stats, setStats] = useState<CategoryIndexingStat[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<ReindexBatchResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const [visualStats, setVisualStats] = useState<VisualEmbeddingCoverageStats | null>(null)
  const [visualLoading, setVisualLoading] = useState(true)
  const [visualAction, setVisualAction] = useState<'process' | 'backfill' | 'retry' | null>(null)
  const [visualActionError, setVisualActionError] = useState<string | null>(null)
  const [lastBackfill, setLastBackfill] = useState<VisualEmbeddingBackfillResult | null>(null)

  function load() {
    setLoading(true)
    setLoadError(null)
    getCategoryIndexingStats()
      .then(setStats)
      .catch(() => setLoadError('No se pudieron cargar las estadísticas.'))
      .finally(() => setLoading(false))
  }

  function loadVisualStats() {
    setVisualLoading(true)
    getVisualEmbeddingCoverageStats()
      .then(setVisualStats)
      .catch(() => {})
      .finally(() => setVisualLoading(false))
  }

  useEffect(() => {
    load()
    loadVisualStats()
  }, [])

  async function handleRunBatch() {
    setRunning(true)
    setRunError(null)
    try {
      const result = await reindexCatalogImagesBatch(5)
      setLastRun(result)
      load()
    } catch {
      setRunError('No se pudo continuar la indexación. Intente de nuevo.')
    } finally {
      setRunning(false)
    }
  }

  async function handleProcessPending() {
    setVisualAction('process')
    setVisualActionError(null)
    try {
      await processVisualEmbeddingBatch()
      loadVisualStats()
    } catch {
      setVisualActionError('No se pudo procesar el lote de embeddings visuales.')
    } finally {
      setVisualAction(null)
    }
  }

  async function handleBackfill() {
    setVisualAction('backfill')
    setVisualActionError(null)
    try {
      const result = await backfillVisualEmbeddings()
      setLastBackfill(result)
      loadVisualStats()
    } catch {
      setVisualActionError('No se pudo continuar el backfill.')
    } finally {
      setVisualAction(null)
    }
  }

  async function handleRetryFailed() {
    setVisualAction('retry')
    setVisualActionError(null)
    try {
      const result = await retryFailedVisualEmbeddings()
      setLastBackfill(result)
      loadVisualStats()
    } catch {
      setVisualActionError('No se pudieron reintentar las imágenes fallidas.')
    } finally {
      setVisualAction(null)
    }
  }

  const totals = stats.reduce(
    (acc, s) => ({
      productsWithImages: acc.productsWithImages + s.productsWithImages,
      imagesIndexed: acc.imagesIndexed + s.imagesIndexed,
      imagesPending: acc.imagesPending + s.imagesPending,
      imagesFailed: acc.imagesFailed + s.imagesFailed,
    }),
    { productsWithImages: 0, imagesIndexed: 0, imagesPending: 0, imagesFailed: 0 },
  )

  const categoriesWithoutIndexedImages = stats.filter((s) => s.productsWithImages > 0 && s.imagesIndexed === 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Búsqueda visual"
        description="Estado de la indexación de imágenes para la búsqueda de productos por foto."
        actions={
          <Button size="sm" onClick={handleRunBatch} disabled={running}>
            {running ? 'Indexando…' : 'Indexar pendientes (lote de 5)'}
          </Button>
        }
      />

      {runError && <p className="text-sm text-red-500">{runError}</p>}

      {lastRun && (
        <Card>
          <p className="text-sm text-zinc-600">
            Último lote: {lastRun.succeeded} correctas, {lastRun.failed} con error de {lastRun.processedCount} procesadas.
            {' '}
            {lastRun.remainingCount > 0
              ? `Quedan aproximadamente ${lastRun.remainingCount} pendientes en la ventana actual — pulsa "Indexar pendientes" de nuevo para continuar.`
              : 'No quedan imágenes pendientes en la ventana revisada.'}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Productos con imágenes" value={totals.productsWithImages} />
        <StatCard label="Imágenes indexadas" value={totals.imagesIndexed} variant="success" />
        <StatCard label="Pendientes" value={totals.imagesPending} variant="warning" />
        <StatCard label="Con error" value={totals.imagesFailed} variant="danger" />
      </div>

      {categoriesWithoutIndexedImages.length > 0 && (
        <Card>
          <p className="text-sm text-zinc-600">
            Categorías con productos pero sin ninguna imagen indexada todavía:{' '}
            <span className="font-medium text-zinc-800">
              {categoriesWithoutIndexedImages.map((c) => c.categoryName).join(', ')}
            </span>
          </p>
        </Card>
      )}

      <div>
        <SectionTitle
          title="Motor de embeddings visuales"
          description="Comparación imagen contra imagen por píxeles — no usa OpenAI para indexar ni para búsquedas normales."
        />

        {visualActionError && <p className="mb-3 text-sm text-red-500">{visualActionError}</p>}

        {visualStats && (
          <p className="mb-3 text-xs text-zinc-500">
            Modelo activo:{' '}
            <span className="font-medium text-zinc-700">
              {visualStats.activeProvider ?? 'sin configurar'} · {visualStats.activeModel ?? '—'} ·{' '}
              {visualStats.activeModelVersion ?? '—'}
            </span>
          </p>
        )}

        {lastBackfill && (
          <Card className="mb-3">
            <p className="text-sm text-zinc-600">
              {lastBackfill.action === 'backfill'
                ? `Se encolaron ${lastBackfill.enqueuedCount} imágenes nuevas para procesar.`
                : `Se reintentarán ${lastBackfill.retriedCount} imágenes que habían fallado.`}{' '}
              Pendientes en cola: {lastBackfill.remainingPendingCount}. Con error: {lastBackfill.remainingFailedCount}.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <StatCard label="Total de imágenes" value={visualStats?.totalImages ?? 0} />
          <StatCard label="Indexadas" value={visualStats?.indexedImages ?? 0} variant="success" />
          <StatCard label="Pendientes" value={visualStats?.pendingImages ?? 0} variant="warning" />
          <StatCard label="Procesando" value={visualStats?.processingImages ?? 0} />
          <StatCard label="Con error" value={visualStats?.failedImages ?? 0} variant="danger" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={handleProcessPending} disabled={visualAction !== null || visualLoading}>
            {visualAction === 'process' ? 'Procesando…' : 'Procesar pendientes'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleBackfill}
            disabled={visualAction !== null || visualLoading}
          >
            {visualAction === 'backfill' ? 'Encolando…' : 'Continuar backfill'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRetryFailed}
            disabled={visualAction !== null || visualLoading}
          >
            {visualAction === 'retry' ? 'Reintentando…' : 'Reintentar fallidas'}
          </Button>
        </div>
      </div>

      <Card padding={false}>
        {loadError ? (
          <p className="px-6 py-12 text-center text-sm text-red-500">{loadError}</p>
        ) : loading ? (
          <p className="px-6 py-12 text-center text-sm text-zinc-400">Cargando estadísticas…</p>
        ) : stats.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-zinc-400">No hay categorías registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Productos con imágenes</th>
                  <th className="px-4 py-3">Indexadas</th>
                  <th className="px-4 py-3">Pendientes</th>
                  <th className="px-4 py-3">Con error</th>
                  <th className="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => {
                  const ready = s.productsWithImages > 0 && s.imagesIndexed > 0 && s.imagesPending === 0
                  return (
                    <tr key={s.categoryId} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{s.categoryName}</td>
                      <td className="px-4 py-3 text-zinc-600">{s.productsWithImages}</td>
                      <td className="px-4 py-3 text-zinc-600">{s.imagesIndexed}</td>
                      <td className="px-4 py-3 text-zinc-600">{s.imagesPending}</td>
                      <td className="px-4 py-3 text-zinc-600">{s.imagesFailed}</td>
                      <td className="px-4 py-3">
                        {s.productsWithImages === 0 ? (
                          <Badge label="Sin productos" variant="default" />
                        ) : ready ? (
                          <Badge label="Lista para búsqueda" variant="success" />
                        ) : (
                          <Badge label="En progreso" variant="warning" />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function StatCard({
  label,
  value,
  variant = 'default',
}: {
  label: string
  value: number
  variant?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const colors: Record<string, string> = {
    default: 'text-zinc-900',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600',
  }
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${colors[variant]}`}>{value.toLocaleString('es-CO')}</p>
    </Card>
  )
}
