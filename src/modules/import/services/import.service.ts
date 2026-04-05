import { supabase } from '@/lib/supabase'
import { slugifyWithSuffix, slugify } from '@/shared/utils/slugify'
import { parseCsvText, validateCsvHeaders, mapRowToImportData } from './csv-parser'
import { parseCompatibilityText } from './compatibility-parser'
import type { ImportResult, ImportRowStatus } from '@/types'
import type { Product } from '@/types'

// ─── Public API ──────────────────────────────────────────────────────────────

export async function processCsvFile(
  file: File,
  importedBy: string,
): Promise<{ result: ImportResult | null; error: string | null }> {
  const text = await readFileAsText(file)
  const rawRows = parseCsvText(text)

  if (rawRows.length === 0) {
    return { result: null, error: 'El archivo CSV está vacío o no tiene el formato correcto.' }
  }

  const headers = Object.keys(rawRows[0])
  const { valid, missing } = validateCsvHeaders(headers)
  if (!valid) {
    return {
      result: null,
      error: `Columnas requeridas no encontradas: ${missing.join(', ')}`,
    }
  }

  // Create batch record
  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      filename: file.name,
      status: 'pending',
      total_rows: rawRows.length,
      imported_by: importedBy,
    })
    .select('id')
    .single()

  if (batchError || !batch) {
    return { result: null, error: 'No se pudo crear el lote de importación.' }
  }

  const batchId = batch.id as string

  // Stage all rows immediately — raw data is preserved before any processing
  const stagedRows = rawRows.map((row, idx) => ({
    batch_id: batchId,
    row_number: idx + 1,
    ci: (row['CI'] ?? '').trim() || null,
    raw_data: row,
    status: 'pending' as ImportRowStatus,
  }))

  const { data: insertedRows, error: stagingError } = await supabase
    .from('import_rows')
    .insert(stagedRows)
    .select('id, row_number')

  if (stagingError || !insertedRows) {
    await supabase.from('import_batches').update({ status: 'failed' }).eq('id', batchId)
    return { result: null, error: 'No se pudieron almacenar las filas del CSV.' }
  }

  // Map row_number → staged row id for updates
  const rowIdMap = new Map<number, string>(
    (insertedRows as Array<{ id: string; row_number: number }>).map((r) => [r.row_number, r.id]),
  )

  await supabase
    .from('import_batches')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', batchId)

  let importedCount = 0
  let updatedCount  = 0
  const skippedCount = 0
  let failedCount   = 0

  try {
    for (let i = 0; i < rawRows.length; i++) {
      const rowNumber = i + 1
      const rowId = rowIdMap.get(rowNumber)!
      const data = mapRowToImportData(rawRows[i])

      if (!data.ci) {
        await resolveImportRow(rowId, 'failed', null, 'CI vacío o ausente')
        failedCount++
        continue
      }

      try {
        const existing = await getProductByCi(data.ci)

        const typeId = data.product_type_name
          ? await upsertLookup('product_types', data.product_type_name)
          : null

        const brandId = data.product_brand_name
          ? await upsertLookup('product_brands', data.product_brand_name)
          : null

        const vehicleBrandId = data.vehicle_brand_name
          ? await upsertLookup('vehicle_brands', data.vehicle_brand_name)
          : null

        const slug = slugifyWithSuffix(data.base_name, data.ci)

        const productPayload = {
          ci:                data.ci,
          base_name:         data.base_name,
          slug,
          reference:         data.reference,
          description:       data.description,
          sale_price:        data.sale_price,
          cost_price:        data.cost_price,
          stock:             data.stock,
          type_id:           typeId,
          brand_id:          brandId,
          raw_compatibility: data.raw_compatibility,
        }

        let productId: string

        if (existing) {
          // Never overwrite display_name or status on re-import
          await supabase
            .from('products')
            .update({ ...productPayload, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
          productId = existing.id
          updatedCount++
        } else {
          const { data: created, error } = await supabase
            .from('products')
            .insert({ ...productPayload, status: 'draft' })
            .select('id')
            .single()
          if (error || !created) throw new Error(error?.message ?? 'Error al crear producto')
          productId = (created as { id: string }).id
          importedCount++
        }

        if (data.raw_compatibility) {
          await upsertCompatibilityRecords(
            productId,
            data.raw_compatibility,
            vehicleBrandId,
            data.vehicle_brand_name,
          )
        }

        await resolveImportRow(rowId, existing ? 'updated' : 'imported', productId, null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        await resolveImportRow(rowId, 'failed', null, message)
        failedCount++
      }
    }
  } finally {
    // Always finalize the batch — even if an unexpected error escapes the per-row catch.
    // This prevents batches from being permanently stuck in 'processing'.
    const finalStatus =
      failedCount === rawRows.length && importedCount === 0 && updatedCount === 0
        ? 'failed'
        : 'completed'

    await supabase
      .from('import_batches')
      .update({
        status:         finalStatus,
        imported_count: importedCount,
        updated_count:  updatedCount,
        skipped_count:  skippedCount,
        failed_count:   failedCount,
        completed_at:   new Date().toISOString(),
      })
      .eq('id', batchId)
  }

  return {
    result: { batchId, importedCount, updatedCount, skippedCount, failedCount },
    error: null,
  }
}

export async function retryBatchFailedRows(
  batchId: string,
): Promise<{ result: ImportResult | null; error: string | null }> {
  // Guard: never retry a batch that is actively processing
  const { data: batch, error: batchFetchError } = await supabase
    .from('import_batches')
    .select('status')
    .eq('id', batchId)
    .single()

  if (batchFetchError || !batch) {
    return { result: null, error: 'No se encontró el lote especificado.' }
  }

  if (batch.status === 'processing') {
    return { result: null, error: 'El lote está siendo procesado actualmente. Intente de nuevo en unos momentos.' }
  }

  // Load failed rows with their stored raw data
  const { data: failedRows, error: rowsError } = await supabase
    .from('import_rows')
    .select('id, row_number, raw_data')
    .eq('batch_id', batchId)
    .eq('status', 'failed')
    .order('row_number', { ascending: true })

  if (rowsError) {
    return { result: null, error: 'No se pudieron cargar las filas fallidas.' }
  }

  if (!failedRows || failedRows.length === 0) {
    return { result: null, error: 'No hay filas fallidas para reintentar en este lote.' }
  }

  // Reset each failed row to a clean retryable state
  const failedIds = failedRows.map((r) => r.id)
  await supabase
    .from('import_rows')
    .update({ status: 'pending', error_message: null, processed_at: null })
    .in('id', failedIds)

  // Mark batch as processing
  await supabase
    .from('import_batches')
    .update({ status: 'processing', started_at: new Date().toISOString() })
    .eq('id', batchId)

  try {
    for (const failedRow of failedRows) {
      const rowId = failedRow.id as string
      const data = mapRowToImportData(failedRow.raw_data as Record<string, string>)

      if (!data.ci) {
        await resolveImportRow(rowId, 'failed', null, 'CI vacío o ausente')
        continue
      }

      try {
        const existing = await getProductByCi(data.ci)

        const typeId = data.product_type_name
          ? await upsertLookup('product_types', data.product_type_name)
          : null

        const brandId = data.product_brand_name
          ? await upsertLookup('product_brands', data.product_brand_name)
          : null

        const vehicleBrandId = data.vehicle_brand_name
          ? await upsertLookup('vehicle_brands', data.vehicle_brand_name)
          : null

        const slug = slugifyWithSuffix(data.base_name, data.ci)

        const productPayload = {
          ci:                data.ci,
          base_name:         data.base_name,
          slug,
          reference:         data.reference,
          description:       data.description,
          sale_price:        data.sale_price,
          cost_price:        data.cost_price,
          stock:             data.stock,
          type_id:           typeId,
          brand_id:          brandId,
          raw_compatibility: data.raw_compatibility,
        }

        let productId: string

        if (existing) {
          await supabase
            .from('products')
            .update({ ...productPayload, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
          productId = existing.id
        } else {
          const { data: created, error } = await supabase
            .from('products')
            .insert({ ...productPayload, status: 'draft' })
            .select('id')
            .single()
          if (error || !created) throw new Error(error?.message ?? 'Error al crear producto')
          productId = (created as { id: string }).id
        }

        if (data.raw_compatibility) {
          await upsertCompatibilityRecords(
            productId,
            data.raw_compatibility,
            vehicleBrandId,
            data.vehicle_brand_name,
          )
        }

        await resolveImportRow(rowId, existing ? 'updated' : 'imported', productId, null)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        await resolveImportRow(rowId, 'failed', null, message)
      }
    }
  } finally {
    // Recount all rows in the batch to avoid arithmetic drift from previous runs
    const { data: allRows } = await supabase
      .from('import_rows')
      .select('status')
      .eq('batch_id', batchId)

    const counts = { imported: 0, updated: 0, skipped: 0, failed: 0 }
    for (const row of allRows ?? []) {
      if (row.status === 'imported')      counts.imported++
      else if (row.status === 'updated')  counts.updated++
      else if (row.status === 'skipped')  counts.skipped++
      else if (row.status === 'failed')   counts.failed++
    }

    const total = (allRows ?? []).length
    const finalStatus =
      counts.failed === total && counts.imported === 0 && counts.updated === 0
        ? 'failed'
        : 'completed'

    await supabase
      .from('import_batches')
      .update({
        status:         finalStatus,
        imported_count: counts.imported,
        updated_count:  counts.updated,
        skipped_count:  counts.skipped,
        failed_count:   counts.failed,
        completed_at:   new Date().toISOString(),
      })
      .eq('id', batchId)
  }

  // Read final counts for the return value
  const { data: finalBatch } = await supabase
    .from('import_batches')
    .select('imported_count, updated_count, skipped_count, failed_count')
    .eq('id', batchId)
    .single()

  return {
    result: {
      batchId,
      importedCount: (finalBatch as { imported_count: number } | null)?.imported_count ?? 0,
      updatedCount:  (finalBatch as { updated_count: number }  | null)?.updated_count  ?? 0,
      skippedCount:  (finalBatch as { skipped_count: number }  | null)?.skipped_count  ?? 0,
      failedCount:   (finalBatch as { failed_count: number }   | null)?.failed_count   ?? 0,
    },
    error: null,
  }
}

export async function getImportBatches() {
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getImportBatchRows(batchId: string) {
  const { data, error } = await supabase
    .from('import_rows')
    .select('*')
    .eq('batch_id', batchId)
    .order('row_number', { ascending: true })
  if (error) throw error
  return data
}

/**
 * Recovers a batch left permanently in 'processing' due to an interrupted run.
 * Reconstructs counts from import_rows, marks remaining pending rows as failed,
 * and sets the batch to 'failed'.
 *
 * Safe to call multiple times — idempotent on already-resolved batches.
 */
export async function recoverStuckBatch(batchId: string): Promise<void> {
  // Mark any rows still pending as failed
  await supabase
    .from('import_rows')
    .update({
      status:        'failed',
      error_message: 'Lote interrumpido antes de procesar esta fila',
      processed_at:  new Date().toISOString(),
    })
    .eq('batch_id', batchId)
    .eq('status', 'pending')

  // Reconstruct counts from the rows table
  const { data: rows } = await supabase
    .from('import_rows')
    .select('status')
    .eq('batch_id', batchId)

  const counts = { imported: 0, updated: 0, skipped: 0, failed: 0 }
  for (const row of rows ?? []) {
    if (row.status === 'imported') counts.imported++
    else if (row.status === 'updated') counts.updated++
    else if (row.status === 'skipped') counts.skipped++
    else if (row.status === 'failed')  counts.failed++
  }

  await supabase
    .from('import_batches')
    .update({
      status:         'failed',
      imported_count: counts.imported,
      updated_count:  counts.updated,
      skipped_count:  counts.skipped,
      failed_count:   counts.failed,
      completed_at:   new Date().toISOString(),
    })
    .eq('id', batchId)
    .eq('status', 'processing') // only touch stuck batches, not already-resolved ones
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function getProductByCi(ci: string): Promise<Pick<Product, 'id' | 'status'> | null> {
  const { data } = await supabase
    .from('products')
    .select('id, status')
    .eq('ci', ci)
    .maybeSingle()
  return data as Pick<Product, 'id' | 'status'> | null
}

async function upsertLookup(
  table: 'product_types' | 'product_brands' | 'vehicle_brands',
  name: string,
): Promise<string> {
  // Step 1: exact-name lookup — avoids touching the slug constraint entirely
  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (existing) return (existing as { id: string }).id

  // Step 2: insert with deterministic slug; retry with numeric suffix on collision
  const baseSlug = slugify(name)
  const MAX_ATTEMPTS = 10

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`

    const { data, error } = await supabase
      .from(table)
      .insert({ name, slug })
      .select('id')
      .single()

    if (data) return (data as { id: string }).id

    // 23505 = unique_violation — slug already taken by a different name, retry
    if (error?.code === '23505' && error.message.includes('slug')) continue

    throw new Error(`No se pudo insertar en ${table}: ${error?.message}`)
  }

  throw new Error(`No se pudo insertar en ${table}: colisión de slug tras ${MAX_ATTEMPTS} intentos`)
}

async function upsertVehicleModel(vehicleBrandId: string, modelName: string): Promise<string> {
  const { data, error } = await supabase
    .from('vehicle_models')
    .upsert(
      { vehicle_brand_id: vehicleBrandId, name: modelName, slug: slugify(modelName) },
      { onConflict: 'vehicle_brand_id,name' },
    )
    .select('id')
    .single()
  if (error || !data) throw new Error(`No se pudo upsert vehicle_model: ${error?.message}`)
  return (data as { id: string }).id
}

async function upsertCompatibilityRecords(
  productId: string,
  rawCompatibility: string,
  vehicleBrandId: string | null,
  vehicleBrandName: string | null,
): Promise<void> {
  await supabase
    .from('product_compatibility')
    .delete()
    .eq('product_id', productId)
    .eq('is_verified', false)

  const fragments = parseCompatibilityText(rawCompatibility, vehicleBrandName)

  for (const fragment of fragments) {
    let vehicleModelId: string | null = null

    if (vehicleBrandId && fragment.vehicleModelName) {
      try {
        vehicleModelId = await upsertVehicleModel(vehicleBrandId, fragment.vehicleModelName)
      } catch {
        // Model upsert failed — write partial record
      }
    }

    await supabase.from('product_compatibility').insert({
      product_id:          productId,
      vehicle_brand_id:    vehicleBrandId,
      vehicle_model_id:    vehicleModelId,
      year_from:           fragment.yearFrom,
      year_to:             fragment.yearTo,
      notes:               fragment.notes ?? null,
      raw_source_fragment: fragment.rawFragment,
      parse_status:        vehicleModelId ? fragment.parseStatus : 'partial',
      is_verified:         false,
    })
  }
}

async function resolveImportRow(
  rowId: string,
  status: 'imported' | 'updated' | 'skipped' | 'failed',
  productId: string | null,
  errorMessage: string | null,
): Promise<void> {
  await supabase
    .from('import_rows')
    .update({
      status,
      product_id:    productId,
      error_message: errorMessage,
      processed_at:  new Date().toISOString(),
    })
    .eq('id', rowId)
}

// Detects encoding from the file buffer and decodes accordingly.
// Priority: UTF-8 BOM → UTF-8 (if clean) → windows-1252 fallback.
// This handles the common case of CSV files exported from Excel on Latin American systems.
async function readFileAsText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // UTF-8 BOM: EF BB BF
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(buffer)
  }

  // Attempt UTF-8: if no replacement characters appear, the file is valid UTF-8
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('\uFFFD')) {
    return utf8
  }

  // Fall back to windows-1252 (standard Excel CSV encoding for Latin American locales)
  return new TextDecoder('windows-1252').decode(buffer)
}
