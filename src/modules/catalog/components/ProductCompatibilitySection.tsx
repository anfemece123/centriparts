import { useState } from 'react'
import { Button, Badge, ConfirmModal } from '@/shared/components/ui'
import {
  deleteCompatibilityRow,
  verifyCompatibilityRow,
} from '@/modules/catalog/services/compatibility.service'
import CompatibilityFormModal from './CompatibilityFormModal'
import type { ProductCompatibility, VehicleBrand, VehicleModel, ParseStatus } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CompatibilityRow = ProductCompatibility & {
  vehicle_brand: VehicleBrand | null
  vehicle_model: VehicleModel | null
}

interface Props {
  productId: string
  compatibility: CompatibilityRow[]
  onRefresh: () => Promise<void>
}

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; row: CompatibilityRow }
  | { type: 'delete'; row: CompatibilityRow }

// ── Constants ─────────────────────────────────────────────────────────────────

const PARSE_LABELS: Record<ParseStatus, string> = {
  auto:    'Automático',
  partial: 'Incompleto',
  manual:  'Manual',
}

const PARSE_BADGE: Record<ParseStatus, 'success' | 'warning' | 'info'> = {
  auto:    'success',
  partial: 'warning',
  manual:  'info',
}

// ── Action button styles ──────────────────────────────────────────────────────

const actionBtn =
  'text-xs font-medium text-zinc-500 hover:text-zinc-800 transition-colors px-1 py-0.5 disabled:opacity-40'
const actionBtnDanger =
  'text-xs font-medium text-red-400 hover:text-red-600 transition-colors px-1 py-0.5 disabled:opacity-40'
const actionBtnVerify =
  'text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors px-1 py-0.5 disabled:opacity-40'

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductCompatibilitySection({
  productId,
  compatibility,
  onRefresh,
}: Props) {
  const [modal, setModal]           = useState<ModalState | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)

  function closeModal() { setModal(null) }

  async function handleSaved() {
    setModal(null)
    await onRefresh()
  }

  async function handleVerify(row: CompatibilityRow) {
    setVerifyingId(row.id)
    try {
      await verifyCompatibilityRow(row.id)
      await onRefresh()
    } catch {
      // non-critical — refresh to get latest state
      await onRefresh()
    } finally {
      setVerifyingId(null)
    }
  }

  const partialCount = compatibility.filter((c) => c.parse_status === 'partial').length
  const unverifiedCount = compatibility.filter((c) => !c.is_verified).length

  return (
    <>
      {/* ── Section ───────────────────────────────────────────────────────── */}
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-700">Compatibilidad</h2>
            <p className="mt-0.5 text-xs text-zinc-400">
              {compatibility.length} registro{compatibility.length !== 1 ? 's' : ''}
              {partialCount > 0 && (
                <span className="ml-2 font-medium text-amber-500">
                  · {partialCount} incompleto{partialCount !== 1 ? 's' : ''}
                </span>
              )}
              {unverifiedCount > 0 && (
                <span className="ml-2 text-zinc-400">
                  · {unverifiedCount} sin verificar
                </span>
              )}
            </p>
          </div>
          <Button size="sm" onClick={() => setModal({ type: 'add' })}>
            + Agregar
          </Button>
        </div>

        {/* Body */}
        {compatibility.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-sm text-zinc-400">Sin registros de compatibilidad.</p>
            <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'add' })}>
              + Agregar primer registro
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Marca</th>
                  <th className="px-4 py-3">Modelo</th>
                  <th className="px-4 py-3 whitespace-nowrap">Desde</th>
                  <th className="px-4 py-3 whitespace-nowrap">Hasta</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Verificado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {compatibility.map((row) => {
                  const isPartial = row.parse_status === 'partial'
                  const isVerifying = verifyingId === row.id

                  return (
                    <tr
                      key={row.id}
                      className={[
                        'transition-colors',
                        isPartial ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-zinc-50',
                      ].join(' ')}
                    >
                      {/* Brand */}
                      <td className="px-4 py-2.5 text-zinc-700">
                        <div className="flex items-center gap-1.5">
                          {isPartial && (
                            <span
                              className="text-amber-500 leading-none"
                              title="Registro incompleto — requiere revisión"
                            >
                              ⚠
                            </span>
                          )}
                          {row.vehicle_brand?.name ?? (
                            <span className="italic text-zinc-400">Todas las marcas</span>
                          )}
                        </div>
                      </td>

                      {/* Model */}
                      <td className="px-4 py-2.5 text-zinc-700">
                        {row.vehicle_model?.name ?? (
                          <span className="italic text-zinc-400">
                            {row.vehicle_brand ? 'Todos los modelos' : '—'}
                          </span>
                        )}
                      </td>

                      {/* Year from */}
                      <td className="px-4 py-2.5 tabular-nums text-zinc-500">
                        {row.year_from ?? '—'}
                      </td>

                      {/* Year to */}
                      <td className="px-4 py-2.5 tabular-nums text-zinc-500">
                        {row.year_to ?? '—'}
                      </td>

                      {/* Parse status */}
                      <td className="px-4 py-2.5">
                        <Badge
                          label={PARSE_LABELS[row.parse_status]}
                          variant={PARSE_BADGE[row.parse_status]}
                        />
                      </td>

                      {/* Verified */}
                      <td className="px-4 py-2.5">
                        {row.is_verified ? (
                          <Badge label="Verificado" variant="success" />
                        ) : (
                          <Badge label="Pendiente" variant="default" />
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {!row.is_verified && (
                            <>
                              <button
                                type="button"
                                className={actionBtnVerify}
                                disabled={isVerifying}
                                onClick={() => handleVerify(row)}
                                title="Marcar como verificado"
                              >
                                {isVerifying ? '…' : 'Verificar'}
                              </button>
                              <span className="text-zinc-200">|</span>
                            </>
                          )}
                          <button
                            type="button"
                            className={actionBtn}
                            onClick={() => setModal({ type: 'edit', row })}
                          >
                            Editar
                          </button>
                          <span className="text-zinc-200">|</span>
                          <button
                            type="button"
                            className={actionBtnDanger}
                            onClick={() => setModal({ type: 'delete', row })}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      {modal?.type === 'add' && (
        <CompatibilityFormModal
          mode="add"
          productId={productId}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {modal?.type === 'edit' && (
        <CompatibilityFormModal
          mode="edit"
          productId={productId}
          initial={modal.row}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}

      {modal?.type === 'delete' && (
        <ConfirmModal
          title="Eliminar registro de compatibilidad"
          message={
            <span>
              ¿Eliminar la compatibilidad con{' '}
              <strong>
                {modal.row.vehicle_brand?.name ?? 'marca desconocida'}
                {modal.row.vehicle_model ? ` ${modal.row.vehicle_model.name}` : ''}
              </strong>
              {modal.row.year_from || modal.row.year_to
                ? ` (${modal.row.year_from ?? '?'} – ${modal.row.year_to ?? '?'})`
                : ''}
              ?{' '}Esta acción no se puede deshacer.
            </span>
          }
          confirmLabel="Eliminar"
          danger
          onConfirm={async () => {
            await deleteCompatibilityRow(modal.row.id)
            await onRefresh()
          }}
          onClose={closeModal}
        />
      )}
    </>
  )
}
