import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parseCompatibilityText } from '../src/modules/import/services/compatibility-parser.ts'
import { deriveProductCategory } from '../src/modules/import/services/category-derivation.ts'
import {
  mapRowToImportData,
  parseCsvText,
  validateCsvHeaders,
} from '../src/modules/import/services/csv-parser.ts'
import { slugify, slugifyWithSuffix } from '../src/shared/utils/slugify.ts'

const PAGE_SIZE = 1_000
const WRITE_BATCH_SIZE = 150
const DELETE_BATCH_SIZE = 100
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'
const STORAGE_BUCKET = 'product-images'

type JsonRow = Record<string, unknown>
type ImportedProduct = ReturnType<typeof mapRowToImportData>

interface LookupRow {
  id: string
  name: string
  slug: string
}

interface VehicleModelRow extends LookupRow {
  vehicle_brand_id: string
}

interface ProductRow extends JsonRow {
  id: string
  ci: string
}

interface CategoryRow extends JsonRow {
  id: string
  name: string
  slug: string
  description: string | null
  parent_id: string | null
  is_active: boolean
}

interface CategoryRebuildSummary {
  mainCategories: number
  subcategories: number
  deletedObsoleteCategories: number
  assignments: number
  primaryAssignments: number
}

interface CategoryPlanEntry {
  ci: string
  mainCategory: string
  subcategory: string | null
}

interface CategoryPlan {
  entries: CategoryPlanEntry[]
  mainCategories: string[]
  subcategoryParents: Map<string, string>
}

interface BackupData {
  createdAt: string
  sourceFile: string
  storagePaths: string[]
  tables: Record<string, JsonRow[]>
}

interface CategoryStateBackup {
  createdAt: string
  sourceFile: string
  categories: CategoryRow[]
  assignments: JsonRow[]
}

interface PreparedCompatibility {
  product_id: string
  vehicle_brand_id: string | null
  vehicle_model_id: string | null
  year_from: number | null
  year_to: number | null
  notes: string | null
  raw_source_fragment: string
  parse_status: 'auto' | 'partial'
  is_verified: false
}

const BACKUP_TABLES = [
  'products',
  'product_images',
  'categories',
  'product_categories',
  'product_compatibility',
  'product_types',
  'product_brands',
  'vehicle_brands',
  'vehicle_models',
] as const

function loadEnvironment(): Record<string, string> {
  const lines = readFileSync('.env', 'utf8').split(/\r?\n/)
  const environment: Record<string, string> = {}

  for (const line of lines) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const separatorIndex = line.indexOf('=')
    environment[line.slice(0, separatorIndex)] = line.slice(separatorIndex + 1)
  }

  return environment
}

function decodeInventoryFile(path: string): string {
  const bytes = readFileSync(path)

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes)
  }

  const utf8 = new TextDecoder('utf-8').decode(bytes)
  return utf8.includes('\uFFFD')
    ? new TextDecoder('windows-1252').decode(bytes)
    : utf8
}

function uniqueValues(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
}

function chunkRows<Row>(rows: Row[], size: number): Row[][] {
  const chunks: Row[][] = []
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size))
  }
  return chunks
}

function createUniqueSlug(name: string, usedSlugs: Set<string>): string {
  const base = slugify(name) || 'registro'
  let candidate = base
  let suffix = 2

  while (usedSlugs.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix++
  }

  usedSlugs.add(candidate)
  return candidate
}

async function fetchAll<Row extends JsonRow>(
  client: SupabaseClient,
  table: string,
): Promise<Row[]> {
  const rows: Row[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw new Error(`No se pudo respaldar ${table}: ${error.message}`)

    const page = (data ?? []) as Row[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
}

async function countRows(client: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`No se pudo contar ${table}: ${error.message}`)
  return count ?? 0
}

async function countRowsWhere(
  client: SupabaseClient,
  table: string,
  column: string,
  value: string | number | boolean,
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, value)
  if (error) throw new Error(`No se pudo contar ${table}: ${error.message}`)
  return count ?? 0
}

async function insertInBatches(
  client: SupabaseClient,
  table: string,
  rows: JsonRow[],
): Promise<void> {
  for (const chunk of chunkRows(rows, WRITE_BATCH_SIZE)) {
    const { error } = await client.from(table).insert(chunk)
    if (error) throw new Error(`No se pudo insertar en ${table}: ${error.message}`)
  }
}

async function upsertInBatches(
  client: SupabaseClient,
  table: string,
  rows: JsonRow[],
  onConflict: string,
): Promise<void> {
  for (const chunk of chunkRows(rows, WRITE_BATCH_SIZE)) {
    const { error } = await client.from(table).upsert(chunk, { onConflict })
    if (error) throw new Error(`No se pudo actualizar ${table}: ${error.message}`)
  }
}

async function deleteAll(
  client: SupabaseClient,
  table: string,
  idColumn: string,
): Promise<void> {
  const { error } = await client.from(table).delete().neq(idColumn, ZERO_UUID)
  if (error) throw new Error(`No se pudo limpiar ${table}: ${error.message}`)
}

async function deleteIds(
  client: SupabaseClient,
  table: string,
  ids: string[],
): Promise<void> {
  for (const chunk of chunkRows(ids, DELETE_BATCH_SIZE)) {
    const { error } = await client.from(table).delete().in('id', chunk)
    if (error) throw new Error(`No se pudieron eliminar registros de ${table}: ${error.message}`)
  }
}

function buildCategoryPlan(importedProducts: ImportedProduct[]): CategoryPlan {
  const entries: CategoryPlanEntry[] = []
  const mainCategories = new Set<string>()
  const subcategoryParents = new Map<string, string>()

  for (const product of importedProducts) {
    const derived = deriveProductCategory(product.base_name)
    if (!derived) throw new Error(`No se pudo derivar la categoría del CI ${product.ci}.`)

    entries.push({ ci: product.ci, ...derived })
    mainCategories.add(derived.mainCategory)
    if (derived.subcategory) {
      subcategoryParents.set(derived.subcategory, derived.mainCategory)
    }
  }

  return {
    entries,
    mainCategories: [...mainCategories].sort((a, b) => a.localeCompare(b, 'es')),
    subcategoryParents,
  }
}

function categoryPayload(row: CategoryRow): JsonRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    parent_id: row.parent_id,
    is_active: row.is_active,
  }
}

async function restoreCategoryDefinitions(
  client: SupabaseClient,
  categories: CategoryRow[],
): Promise<void> {
  const backupIds = new Set(categories.map((category) => category.id))
  const current = await fetchAll<CategoryRow>(client, 'categories')
  await deleteIds(
    client,
    'categories',
    current.filter((category) => !backupIds.has(category.id)).map((category) => category.id),
  )

  const pending = new Map(categories.map((category) => [category.id, category]))
  const restoredIds = new Set(
    current.filter((category) => backupIds.has(category.id)).map((category) => category.id),
  )

  while (pending.size > 0) {
    const ready = [...pending.values()].filter(
      (category) => category.parent_id === null || restoredIds.has(category.parent_id),
    )
    if (ready.length === 0) {
      throw new Error('El respaldo contiene una jerarquía de categorías inválida.')
    }

    await upsertInBatches(client, 'categories', ready.map(categoryPayload), 'id')
    for (const category of ready) {
      pending.delete(category.id)
      restoredIds.add(category.id)
    }
  }
}

async function rebuildCategoryAssignments(
  client: SupabaseClient,
  importedProducts: ImportedProduct[],
  productIdByCi: Map<string, string>,
): Promise<CategoryRebuildSummary> {
  const plan = buildCategoryPlan(importedProducts)
  const desiredNames = new Set([
    ...plan.mainCategories,
    ...plan.subcategoryParents.keys(),
  ])
  const existing = await fetchAll<CategoryRow>(client, 'categories')
  const existingByName = new Map(existing.map((category) => [category.name, category]))
  const obsolete = existing.filter((category) => !desiredNames.has(category.name))

  await deleteAll(client, 'product_categories', 'product_id')
  await deleteIds(client, 'categories', obsolete.map((category) => category.id))

  const retained = existing.filter((category) => desiredNames.has(category.name))
  const usedSlugs = new Set(retained.map((category) => category.slug))
  const mainRows: CategoryRow[] = plan.mainCategories.map((name) => {
    const current = existingByName.get(name)
    return {
      id: current?.id ?? crypto.randomUUID(),
      name,
      slug: current?.slug ?? createUniqueSlug(name, usedSlugs),
      description: current?.description ?? null,
      parent_id: null,
      is_active: true,
    }
  })

  await upsertInBatches(client, 'categories', mainRows.map(categoryPayload), 'id')
  const mainIdByName = new Map(mainRows.map((category) => [category.name, category.id]))

  const subcategoryRows: CategoryRow[] = [...plan.subcategoryParents.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([name, mainCategory]) => {
      const current = existingByName.get(name)
      const parentId = mainIdByName.get(mainCategory)
      if (!parentId) throw new Error(`No se encontró la categoría principal ${mainCategory}.`)

      return {
        id: current?.id ?? crypto.randomUUID(),
        name,
        slug: current?.slug ?? createUniqueSlug(name, usedSlugs),
        description: current?.description ?? null,
        parent_id: parentId,
        is_active: true,
      }
    })

  await upsertInBatches(client, 'categories', subcategoryRows.map(categoryPayload), 'id')
  const subcategoryIdByName = new Map(
    subcategoryRows.map((category) => [category.name, category.id]),
  )

  const assignments: JsonRow[] = []
  for (const entry of plan.entries) {
    const productId = productIdByCi.get(entry.ci)
    const mainCategoryId = mainIdByName.get(entry.mainCategory)
    if (!productId) throw new Error(`No se encontró el producto con CI ${entry.ci}.`)
    if (!mainCategoryId) {
      throw new Error(`No se encontró la categoría principal ${entry.mainCategory}.`)
    }

    assignments.push({
      product_id: productId,
      category_id: mainCategoryId,
      is_primary: true,
    })

    if (entry.subcategory) {
      const subcategoryId = subcategoryIdByName.get(entry.subcategory)
      if (!subcategoryId) throw new Error(`No se encontró la subcategoría ${entry.subcategory}.`)
      assignments.push({
        product_id: productId,
        category_id: subcategoryId,
        is_primary: false,
      })
    }
  }

  await insertInBatches(client, 'product_categories', assignments)

  return {
    mainCategories: mainRows.length,
    subcategories: subcategoryRows.length,
    deletedObsoleteCategories: obsolete.length,
    assignments: assignments.length,
    primaryAssignments: plan.entries.length,
  }
}

async function listStorageFiles(
  client: SupabaseClient,
  prefix = '',
): Promise<string[]> {
  const paths: string[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client.storage
      .from(STORAGE_BUCKET)
      .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } })

    if (error) throw new Error(`No se pudo listar Storage: ${error.message}`)
    const entries = data ?? []

    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.id) {
        paths.push(path)
      } else {
        paths.push(...await listStorageFiles(client, path))
      }
    }

    if (entries.length < PAGE_SIZE) break
  }

  return paths
}

function safeStorageDestination(backupDirectory: string, storagePath: string): string {
  const parts = storagePath.split('/').filter((part) => part && part !== '.' && part !== '..')
  return join(backupDirectory, 'storage', ...parts)
}

async function createBackup(
  client: SupabaseClient,
  csvPath: string,
): Promise<{ data: BackupData; directory: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const directory = join('backups', `catalog-replacement-${timestamp}`)
  mkdirSync(directory, { recursive: true })

  const tables: Record<string, JsonRow[]> = {}
  for (const table of BACKUP_TABLES) {
    process.stdout.write(`Respaldando ${table}… `)
    tables[table] = await fetchAll(client, table)
    console.log(`${tables[table].length} registros`)
  }

  const storagePaths = await listStorageFiles(client)
  for (const storagePath of storagePaths) {
    const { data, error } = await client.storage.from(STORAGE_BUCKET).download(storagePath)
    if (error || !data) throw new Error(`No se pudo respaldar la imagen ${storagePath}: ${error?.message}`)

    const destination = safeStorageDestination(directory, storagePath)
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, Buffer.from(await data.arrayBuffer()))
  }

  const backup: BackupData = {
    createdAt: new Date().toISOString(),
    sourceFile: csvPath,
    storagePaths,
    tables,
  }
  writeFileSync(join(directory, 'catalog.json'), JSON.stringify(backup, null, 2))

  return { data: backup, directory }
}

async function createCategoryStateBackup(
  client: SupabaseClient,
  csvPath: string,
): Promise<{ data: CategoryStateBackup; directory: string }> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const directory = join('backups', `category-rebuild-${timestamp}`)
  mkdirSync(directory, { recursive: true })

  const backup: CategoryStateBackup = {
    createdAt: new Date().toISOString(),
    sourceFile: csvPath,
    categories: await fetchAll<CategoryRow>(client, 'categories'),
    assignments: await fetchAll<JsonRow>(client, 'product_categories'),
  }
  writeFileSync(join(directory, 'categories.json'), JSON.stringify(backup, null, 2))

  return { data: backup, directory }
}

async function restoreCategoryState(
  client: SupabaseClient,
  backup: CategoryStateBackup,
): Promise<void> {
  await deleteAll(client, 'product_categories', 'product_id')
  await restoreCategoryDefinitions(client, backup.categories)
  await insertInBatches(client, 'product_categories', backup.assignments)
}

async function ensureLookupValues(
  client: SupabaseClient,
  table: 'product_types' | 'product_brands' | 'vehicle_brands',
  names: string[],
): Promise<{ values: Map<string, string>; createdIds: string[] }> {
  const existing = await fetchAll<LookupRow>(client, table)
  const values = new Map(existing.map((row) => [row.name, row.id]))
  const usedSlugs = new Set(existing.map((row) => row.slug))
  const createdRows: LookupRow[] = []

  for (const name of names) {
    if (values.has(name)) continue
    const row: LookupRow = {
      id: crypto.randomUUID(),
      name,
      slug: createUniqueSlug(name, usedSlugs),
    }
    values.set(name, row.id)
    createdRows.push(row)
  }

  await insertInBatches(client, table, createdRows)
  return { values, createdIds: createdRows.map((row) => row.id) }
}

function modelKey(vehicleBrandId: string, name: string): string {
  return `${vehicleBrandId}\u0000${name}`
}

async function ensureVehicleModels(
  client: SupabaseClient,
  requestedModels: Array<{ vehicleBrandId: string; name: string }>,
): Promise<{ values: Map<string, string>; createdIds: string[] }> {
  const existing = await fetchAll<VehicleModelRow>(client, 'vehicle_models')
  const values = new Map(existing.map((row) => [modelKey(row.vehicle_brand_id, row.name), row.id]))
  const createdRows: VehicleModelRow[] = []

  for (const model of requestedModels) {
    const key = modelKey(model.vehicleBrandId, model.name)
    if (values.has(key)) continue
    const row: VehicleModelRow = {
      id: crypto.randomUUID(),
      vehicle_brand_id: model.vehicleBrandId,
      name: model.name,
      slug: slugify(model.name) || 'modelo',
    }
    values.set(key, row.id)
    createdRows.push(row)
  }

  await insertInBatches(client, 'vehicle_models', createdRows)
  return { values, createdIds: createdRows.map((row) => row.id) }
}

async function restoreBackup(client: SupabaseClient, backup: BackupData): Promise<void> {
  console.log('Restaurando el catálogo anterior…')
  await deleteAll(client, 'product_categories', 'product_id')
  await deleteAll(client, 'product_compatibility', 'product_id')
  await deleteAll(client, 'product_images', 'product_id')

  if (backup.tables.categories) {
    await restoreCategoryDefinitions(
      client,
      backup.tables.categories as CategoryRow[],
    )
  }

  const oldProducts = backup.tables.products as ProductRow[]
  const oldIds = new Set(oldProducts.map((product) => product.id))
  const currentProducts = await fetchAll<ProductRow>(client, 'products')
  await deleteIds(
    client,
    'products',
    currentProducts.filter((product) => !oldIds.has(product.id)).map((product) => product.id),
  )
  await upsertInBatches(client, 'products', oldProducts, 'id')
  await insertInBatches(client, 'product_categories', backup.tables.product_categories)
  await insertInBatches(client, 'product_compatibility', backup.tables.product_compatibility)
  await insertInBatches(client, 'product_images', backup.tables.product_images)
  console.log('Catálogo anterior restaurado correctamente.')
}

async function cleanUnusedLookups(
  client: SupabaseClient,
  used: {
    productTypeIds: Set<string>
    productBrandIds: Set<string>
    vehicleBrandIds: Set<string>
    vehicleModelIds: Set<string>
  },
): Promise<void> {
  const models = await fetchAll<VehicleModelRow>(client, 'vehicle_models')
  await deleteIds(client, 'vehicle_models', models.filter((row) => !used.vehicleModelIds.has(row.id)).map((row) => row.id))

  const vehicleBrands = await fetchAll<LookupRow>(client, 'vehicle_brands')
  await deleteIds(client, 'vehicle_brands', vehicleBrands.filter((row) => !used.vehicleBrandIds.has(row.id)).map((row) => row.id))

  const productTypes = await fetchAll<LookupRow>(client, 'product_types')
  await deleteIds(client, 'product_types', productTypes.filter((row) => !used.productTypeIds.has(row.id)).map((row) => row.id))

  const productBrands = await fetchAll<LookupRow>(client, 'product_brands')
  await deleteIds(client, 'product_brands', productBrands.filter((row) => !used.productBrandIds.has(row.id)).map((row) => row.id))
}

async function removeStorageFiles(client: SupabaseClient, paths: string[]): Promise<void> {
  for (const chunk of chunkRows(paths, DELETE_BATCH_SIZE)) {
    const { error } = await client.storage.from(STORAGE_BUCKET).remove(chunk)
    if (error) throw new Error(`No se pudieron eliminar imágenes de Storage: ${error.message}`)
  }
}

function validateInventory(rows: Record<string, string>[]): ImportedProduct[] {
  if (rows.length === 0) throw new Error('El CSV no contiene productos.')

  const headerValidation = validateCsvHeaders(Object.keys(rows[0]))
  if (!headerValidation.valid) {
    throw new Error(`Faltan columnas requeridas: ${headerValidation.missing.join(', ')}`)
  }

  const products = rows.map(mapRowToImportData)
  const missingCi = products.filter((product) => !product.ci)
  const missingName = products.filter((product) => !product.base_name)
  const ciCounts = new Map<string, number>()
  for (const product of products) ciCounts.set(product.ci, (ciCounts.get(product.ci) ?? 0) + 1)
  const duplicateCis = [...ciCounts].filter(([, count]) => count > 1).map(([ci]) => ci)

  if (missingCi.length > 0) throw new Error(`${missingCi.length} filas no tienen CI.`)
  if (missingName.length > 0) throw new Error(`${missingName.length} filas no tienen nombre de producto.`)
  if (duplicateCis.length > 0) throw new Error(`Hay CI duplicados: ${duplicateCis.slice(0, 10).join(', ')}`)

  const invalidCompatibility: string[] = []
  for (const product of products) {
    if (!product.raw_compatibility) continue
    const fragments = parseCompatibilityText(product.raw_compatibility, product.vehicle_brand_name)
    for (const fragment of fragments) {
      const invalidStart = fragment.yearFrom !== null && fragment.yearFrom < 1900
      const invalidEnd = fragment.yearTo !== null && fragment.yearTo < 1900
      const invalidOrder =
        fragment.yearFrom !== null &&
        fragment.yearTo !== null &&
        fragment.yearTo < fragment.yearFrom
      if (invalidStart || invalidEnd || invalidOrder) invalidCompatibility.push(product.ci)
    }
  }
  if (invalidCompatibility.length > 0) {
    throw new Error(`Compatibilidades con años inválidos en los CI: ${invalidCompatibility.slice(0, 10).join(', ')}`)
  }

  return products
}

async function replaceCatalog(
  client: SupabaseClient,
  csvPath: string,
  rawRows: Record<string, string>[],
  importedProducts: ImportedProduct[],
): Promise<void> {
  const { data: backup, directory: backupDirectory } = await createBackup(client, csvPath)
  console.log(`Respaldo completo guardado en ${backupDirectory}`)

  const oldProducts = backup.tables.products as ProductRow[]
  const oldProductByCi = new Map(oldProducts.map((product) => [product.ci, product]))
  const incomingCis = new Set(importedProducts.map((product) => product.ci))
  const productIdByCi = new Map(
    importedProducts.map((product) => [
      product.ci,
      oldProductByCi.get(product.ci)?.id ?? crypto.randomUUID(),
    ]),
  )

  let importBatchId: string | null = null
  let databaseCommitted = false

  try {
    const { data: importBatch, error: importBatchError } = await client
      .from('import_batches')
      .insert({
        filename: basename(csvPath),
        status: 'processing',
        total_rows: importedProducts.length,
        imported_count: 0,
        updated_count: 0,
        skipped_count: 0,
        failed_count: 0,
        imported_by: null,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (importBatchError || !importBatch) {
      throw new Error(`No se pudo crear el registro de importación: ${importBatchError?.message}`)
    }
    importBatchId = importBatch.id as string

    console.log('Preparando tipos, marcas y compatibilidades…')
    const productTypes = await ensureLookupValues(
      client,
      'product_types',
      uniqueValues(importedProducts.map((product) => product.product_type_name)),
    )
    const productBrands = await ensureLookupValues(
      client,
      'product_brands',
      uniqueValues(importedProducts.map((product) => product.product_brand_name)),
    )
    const vehicleBrands = await ensureLookupValues(
      client,
      'vehicle_brands',
      uniqueValues(importedProducts.map((product) => product.vehicle_brand_name)),
    )

    const fragmentsByCi = new Map<string, ReturnType<typeof parseCompatibilityText>>()
    const requestedModels = new Map<string, { vehicleBrandId: string; name: string }>()

    for (const product of importedProducts) {
      const fragments = product.raw_compatibility
        ? parseCompatibilityText(product.raw_compatibility, product.vehicle_brand_name)
        : []
      fragmentsByCi.set(product.ci, fragments)

      const vehicleBrandId = product.vehicle_brand_name
        ? vehicleBrands.values.get(product.vehicle_brand_name) ?? null
        : null
      if (!vehicleBrandId) continue

      for (const fragment of fragments) {
        if (!fragment.vehicleModelName) continue
        requestedModels.set(
          modelKey(vehicleBrandId, fragment.vehicleModelName),
          { vehicleBrandId, name: fragment.vehicleModelName },
        )
      }
    }

    const vehicleModels = await ensureVehicleModels(client, [...requestedModels.values()])
    const usedProductTypeIds = new Set<string>()
    const usedProductBrandIds = new Set<string>()
    const usedVehicleBrandIds = new Set<string>()
    const usedVehicleModelIds = new Set<string>()

    const productRows: JsonRow[] = importedProducts.map((product) => {
      const typeId = product.product_type_name
        ? productTypes.values.get(product.product_type_name) ?? null
        : null
      const brandId = product.product_brand_name
        ? productBrands.values.get(product.product_brand_name) ?? null
        : null
      if (typeId) usedProductTypeIds.add(typeId)
      if (brandId) usedProductBrandIds.add(brandId)

      return {
        id: productIdByCi.get(product.ci),
        ci: product.ci,
        base_name: product.base_name,
        display_name: null,
        slug: slugifyWithSuffix(product.base_name, product.ci),
        reference: product.reference,
        description: product.description,
        sale_price: product.sale_price,
        cost_price: product.cost_price,
        stock: product.stock,
        type_id: typeId,
        brand_id: brandId,
        raw_compatibility: product.raw_compatibility,
        status: 'draft',
      }
    })

    const compatibilityRows: PreparedCompatibility[] = []
    for (const product of importedProducts) {
      const productId = productIdByCi.get(product.ci)
      if (!productId) throw new Error(`No se generó ID para el CI ${product.ci}`)

      const vehicleBrandId = product.vehicle_brand_name
        ? vehicleBrands.values.get(product.vehicle_brand_name) ?? null
        : null
      if (vehicleBrandId) usedVehicleBrandIds.add(vehicleBrandId)

      for (const fragment of fragmentsByCi.get(product.ci) ?? []) {
        const vehicleModelId = vehicleBrandId && fragment.vehicleModelName
          ? vehicleModels.values.get(modelKey(vehicleBrandId, fragment.vehicleModelName)) ?? null
          : null
        if (vehicleModelId) usedVehicleModelIds.add(vehicleModelId)

        compatibilityRows.push({
          product_id: productId,
          vehicle_brand_id: vehicleBrandId,
          vehicle_model_id: vehicleModelId,
          year_from: fragment.yearFrom,
          year_to: fragment.yearTo,
          notes: fragment.notes,
          raw_source_fragment: fragment.rawFragment,
          parse_status: vehicleModelId ? fragment.parseStatus : 'partial',
          is_verified: false,
        })
      }
    }

    console.log('Eliminando imágenes, categorías y compatibilidades de prueba…')
    await deleteAll(client, 'product_images', 'product_id')
    await deleteAll(client, 'product_categories', 'product_id')
    await deleteAll(client, 'product_compatibility', 'product_id')

    console.log(`Actualizando ${productRows.length} productos…`)
    await upsertInBatches(client, 'products', productRows, 'ci')
    await insertInBatches(client, 'product_compatibility', compatibilityRows)
    const categorySummary = await rebuildCategoryAssignments(
      client,
      importedProducts,
      productIdByCi,
    )

    const auditRows: JsonRow[] = rawRows.map((row, index) => {
      const product = importedProducts[index]
      return {
        batch_id: importBatchId,
        row_number: index + 1,
        ci: product.ci,
        raw_data: row,
        status: 'imported',
        product_id: productIdByCi.get(product.ci),
        error_message: null,
        processed_at: new Date().toISOString(),
      }
    })
    await insertInBatches(client, 'import_rows', auditRows)

    const importedCountBeforeCommit = await countRows(client, 'products')
    const expectedBeforeCommit = importedProducts.length + oldProducts.filter((product) => !incomingCis.has(product.ci)).length
    if (importedCountBeforeCommit !== expectedBeforeCommit) {
      throw new Error(
        `Conteo inesperado antes de confirmar: ${importedCountBeforeCommit}; se esperaban ${expectedBeforeCommit}.`,
      )
    }

    const obsoleteProductIds = oldProducts
      .filter((product) => !incomingCis.has(product.ci))
      .map((product) => product.id)
    await deleteIds(client, 'products', obsoleteProductIds)
    databaseCommitted = true

    await cleanUnusedLookups(client, {
      productTypeIds: usedProductTypeIds,
      productBrandIds: usedProductBrandIds,
      vehicleBrandIds: usedVehicleBrandIds,
      vehicleModelIds: usedVehicleModelIds,
    })
    await removeStorageFiles(client, backup.storagePaths)

    const completedAt = new Date().toISOString()
    const { error: finishError } = await client
      .from('import_batches')
      .update({
        status: 'completed',
        imported_count: importedProducts.length,
        updated_count: 0,
        skipped_count: 0,
        failed_count: 0,
        completed_at: completedAt,
      })
      .eq('id', importBatchId)
    if (finishError) throw new Error(`No se pudo cerrar el lote: ${finishError.message}`)

    const finalCounts = {
      products: await countRows(client, 'products'),
      images: await countRows(client, 'product_images'),
      categoryDefinitions: await countRows(client, 'categories'),
      categoryAssignments: await countRows(client, 'product_categories'),
      compatibility: await countRows(client, 'product_compatibility'),
      productTypes: await countRows(client, 'product_types'),
      productBrands: await countRows(client, 'product_brands'),
      vehicleBrands: await countRows(client, 'vehicle_brands'),
      vehicleModels: await countRows(client, 'vehicle_models'),
    }

    if (
      finalCounts.products !== importedProducts.length ||
      finalCounts.images !== 0 ||
      finalCounts.categoryAssignments !== categorySummary.assignments
    ) {
      throw new Error(`Verificación final incorrecta: ${JSON.stringify(finalCounts)}`)
    }

    console.log('\nReemplazo completado correctamente:')
    console.log(JSON.stringify({
      sourceRows: importedProducts.length,
      compatibilityRows: compatibilityRows.length,
      categorySummary,
      removedProducts: obsoleteProductIds.length,
      deletedStorageFiles: backup.storagePaths.length,
      backupDirectory,
      importBatchId,
      finalCounts,
    }, null, 2))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (!databaseCommitted) {
      try {
        await restoreBackup(client, backup)
      } catch (rollbackError) {
        const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        throw new Error(`${message}\nAdemás falló la restauración automática: ${rollbackMessage}`)
      }
    }

    if (importBatchId) {
      await client
        .from('import_batches')
        .update({
          status: 'failed',
          imported_count: 0,
          failed_count: importedProducts.length,
          completed_at: new Date().toISOString(),
        })
        .eq('id', importBatchId)
    }

    throw new Error(databaseCommitted
      ? `El catálogo nuevo quedó cargado, pero falló una limpieza posterior: ${message}`
      : `El reemplazo falló y se restauró el catálogo anterior: ${message}`)
  }
}

async function rebuildCurrentCatalogCategories(
  client: SupabaseClient,
  csvPath: string,
  importedProducts: ImportedProduct[],
): Promise<void> {
  const currentProducts = await fetchAll<ProductRow>(client, 'products')
  const currentProductByCi = new Map(currentProducts.map((product) => [product.ci, product.id]))
  const missingCis = importedProducts
    .filter((product) => !currentProductByCi.has(product.ci))
    .map((product) => product.ci)

  if (missingCis.length > 0 || currentProducts.length !== importedProducts.length) {
    throw new Error(
      `El catálogo actual no coincide con el CSV. Productos actuales: ${currentProducts.length}; ` +
      `filas del CSV: ${importedProducts.length}; CI faltantes: ${missingCis.slice(0, 10).join(', ') || 'ninguno'}.`,
    )
  }

  const { data: backup, directory: backupDirectory } = await createCategoryStateBackup(
    client,
    csvPath,
  )
  console.log(`Respaldo de categorías guardado en ${backupDirectory}`)

  try {
    const categorySummary = await rebuildCategoryAssignments(
      client,
      importedProducts,
      currentProductByCi,
    )
    const finalCounts = {
      products: await countRows(client, 'products'),
      categoryDefinitions: await countRows(client, 'categories'),
      categoryAssignments: await countRows(client, 'product_categories'),
      primaryAssignments: await countRowsWhere(
        client,
        'product_categories',
        'is_primary',
        true,
      ),
      subcategoryAssignments: await countRowsWhere(
        client,
        'product_categories',
        'is_primary',
        false,
      ),
    }

    const expectedDefinitions = categorySummary.mainCategories + categorySummary.subcategories
    if (
      finalCounts.products !== importedProducts.length ||
      finalCounts.categoryDefinitions !== expectedDefinitions ||
      finalCounts.categoryAssignments !== categorySummary.assignments ||
      finalCounts.primaryAssignments !== importedProducts.length
    ) {
      throw new Error(`La verificación final no coincide: ${JSON.stringify(finalCounts)}`)
    }

    console.log('\nCategorías reconstruidas correctamente:')
    console.log(JSON.stringify({
      categorySummary,
      finalCounts,
      backupDirectory,
    }, null, 2))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await restoreCategoryState(client, backup)
    } catch (rollbackError) {
      const rollbackMessage = rollbackError instanceof Error
        ? rollbackError.message
        : String(rollbackError)
      throw new Error(`${message}\nAdemás falló la restauración: ${rollbackMessage}`)
    }
    throw new Error(`La reconstrucción falló y se restauraron las categorías anteriores: ${message}`)
  }
}

async function main() {
  const argumentsList = process.argv.slice(2)
  const categoriesOnly = argumentsList.includes('--categories-only')
  const confirmedReplacement = argumentsList.includes('--confirm-replace')
  const confirmedCategories = argumentsList.includes('--confirm-categories')
  const csvPath = argumentsList.find((argument) => !argument.startsWith('--'))
  if (!csvPath) {
    throw new Error(
      'Uso: npm run catalog:replace -- <archivo.csv> [--confirm-replace] o ' +
      'npm run catalog:categories -- <archivo.csv> [--confirm-categories]',
    )
  }

  const rawRows = parseCsvText(decodeInventoryFile(csvPath))
  const importedProducts = validateInventory(rawRows)
  const analysis = {
    file: csvPath,
    rows: importedProducts.length,
    zeroPrice: importedProducts.filter((product) => product.sale_price === 0).length,
    zeroCost: importedProducts.filter((product) => product.cost_price === 0).length,
    zeroStock: importedProducts.filter((product) => product.stock === 0).length,
    totalStock: importedProducts.reduce((total, product) => total + product.stock, 0),
    productTypes: uniqueValues(importedProducts.map((product) => product.product_type_name)).length,
    productBrands: uniqueValues(importedProducts.map((product) => product.product_brand_name)).length,
    vehicleBrands: uniqueValues(importedProducts.map((product) => product.vehicle_brand_name)).length,
    mainCategories: buildCategoryPlan(importedProducts).mainCategories.length,
    subcategories: buildCategoryPlan(importedProducts).subcategoryParents.size,
    categoryAssignments: buildCategoryPlan(importedProducts).entries.reduce(
      (total, entry) => total + (entry.subcategory ? 2 : 1),
      0,
    ),
  }

  console.log('Análisis del archivo:')
  console.log(JSON.stringify(analysis, null, 2))

  if (categoriesOnly && !confirmedCategories) {
    console.log('\nSimulación terminada. No se modificó la base de datos.')
    console.log('Agregue --confirm-categories para reconstruir las categorías.')
    return
  }

  if (!categoriesOnly && !confirmedReplacement) {
    console.log('\nSimulación terminada. No se modificó la base de datos.')
    console.log('Agregue --confirm-replace para ejecutar el reemplazo.')
    return
  }

  const environment = loadEnvironment()
  const supabaseUrl = environment.VITE_SUPABASE_URL
  const supabaseKey = environment.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) throw new Error('Faltan las variables de conexión de Supabase.')

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  if (categoriesOnly) {
    await rebuildCurrentCatalogCategories(client, csvPath, importedProducts)
  } else {
    await replaceCatalog(client, csvPath, rawRows, importedProducts)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
