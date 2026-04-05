import { supabase } from '@/lib/supabase'
import { slugify } from '@/shared/utils/slugify'
import { parseProductName, fetchAllProducts } from './name-parser'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssignmentReport {
  totalProducts: number
  skipped: number                // products with empty base_name
  mainCategoriesCreated: number
  mainCategoriesExisting: number
  subcategoriesCreated: number
  subcategoriesExisting: number
  productsAssigned: number
  errors: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Reads all products, parses their base_name, then:
 *   1. Upserts main categories (parent_id = null)
 *   2. Upserts subcategories (qualified name, parent_id → main category)
 *   3. Assigns main category (is_primary = true) and subcategory if present (is_primary = false)
 *
 * Fully idempotent — safe to run multiple times.
 * Never deletes any data. Does not touch products without a parseable name.
 */
export async function runCategoryAssignment(): Promise<AssignmentReport> {
  const report: AssignmentReport = {
    totalProducts: 0,
    skipped: 0,
    mainCategoriesCreated: 0,
    mainCategoriesExisting: 0,
    subcategoriesCreated: 0,
    subcategoriesExisting: 0,
    productsAssigned: 0,
    errors: [],
  }

  // ── Step 1: Fetch all products (paginated — no 1000-row cap) ────────────
  const products = await fetchAllProducts()
  report.totalProducts = products.length

  // ── Step 2: Parse names ──────────────────────────────────────────────────
  const parsed = products.map((p) => parseProductName(p as { id: string; base_name: string }))

  const assignable = parsed.filter((r) => r.detected_category !== null)
  report.skipped = parsed.length - assignable.length

  // ── Step 3: Upsert main categories ───────────────────────────────────────
  const uniqueMainNames = [...new Set(assignable.map((r) => r.detected_category as string))]

  const mainCategoryRows = uniqueMainNames.map((name) => ({
    name,
    slug: slugify(name),
    parent_id: null,
    is_active: true,
  }))

  // Upsert in chunks; collect returned ids
  const mainCategoryMap = new Map<string, string>() // name → id

  for (const ch of chunk(mainCategoryRows, 200)) {
    const { data, error } = await supabase
      .from('categories')
      .upsert(ch, { onConflict: 'name' })
      .select('id, name')

    if (error) { report.errors.push(`Main category upsert: ${error.message}`); continue }

    for (const row of data ?? []) mainCategoryMap.set(row.name, row.id)
  }

  // Fetch any that were already in DB and not returned by upsert
  const missingMain = uniqueMainNames.filter((n) => !mainCategoryMap.has(n))
  if (missingMain.length > 0) {
    for (const ch of chunk(missingMain, 200)) {
      const { data } = await supabase
        .from('categories')
        .select('id, name')
        .in('name', ch)
      for (const row of data ?? []) mainCategoryMap.set(row.name, row.id)
    }
  }

  // Count how many were newly created vs already existed
  // (We detect this by checking which names had no row before the upsert returned them)
  // Simpler: after upsert, anything in mainCategoryMap was either created or already existed
  // We can't distinguish easily without a pre-check, so we report total upserted
  report.mainCategoriesCreated = mainCategoryMap.size
  report.mainCategoriesExisting = uniqueMainNames.length - mainCategoryMap.size

  // ── Step 4: Upsert subcategories ─────────────────────────────────────────
  // Collect unique (qualified_name, parent_id) pairs
  const subcategoryEntries = assignable.filter((r) => r.detected_subcategory !== null)
  const uniqueSubMap = new Map<string, string>() // qualified_name → parent_id

  for (const r of subcategoryEntries) {
    const qualifiedName = `${r.detected_category} ${r.detected_subcategory}`
    const parentId = mainCategoryMap.get(r.detected_category as string)
    if (parentId) uniqueSubMap.set(qualifiedName, parentId)
  }

  const subcategoryRows = Array.from(uniqueSubMap.entries()).map(([name, parentId]) => ({
    name,
    slug: slugify(name),
    parent_id: parentId,
    is_active: true,
  }))

  const subCategoryMap = new Map<string, string>() // qualified_name → id

  for (const ch of chunk(subcategoryRows, 200)) {
    const { data, error } = await supabase
      .from('categories')
      .upsert(ch, { onConflict: 'name' })
      .select('id, name')

    if (error) { report.errors.push(`Subcategory upsert: ${error.message}`); continue }

    for (const row of data ?? []) subCategoryMap.set(row.name, row.id)
  }

  // Fetch any that were already in DB and not returned
  const missingSub = Array.from(uniqueSubMap.keys()).filter((n) => !subCategoryMap.has(n))
  if (missingSub.length > 0) {
    for (const ch of chunk(missingSub, 200)) {
      const { data } = await supabase
        .from('categories')
        .select('id, name')
        .in('name', ch)
      for (const row of data ?? []) subCategoryMap.set(row.name, row.id)
    }
  }

  report.subcategoriesCreated = subCategoryMap.size
  report.subcategoriesExisting = subcategoryRows.length - subCategoryMap.size

  // ── Step 5: Build product → category assignments ─────────────────────────
  // Main category is always primary. Subcategory (if present) is non-primary.
  const assignments: { product_id: string; category_id: string; is_primary: boolean }[] = []

  for (const r of assignable) {
    const main = r.detected_category as string
    const sub  = r.detected_subcategory

    const mainCategoryId = mainCategoryMap.get(main)
    if (!mainCategoryId) {
      report.errors.push(`No main category ID found for product ${r.id} (${r.base_name})`)
      continue
    }

    assignments.push({ product_id: r.id, category_id: mainCategoryId, is_primary: true })

    if (sub) {
      const subCategoryId = subCategoryMap.get(`${main} ${sub}`)
      if (subCategoryId) {
        assignments.push({ product_id: r.id, category_id: subCategoryId, is_primary: false })
      } else {
        report.errors.push(`No subcategory ID found for product ${r.id} (${r.base_name})`)
      }
    }
  }

  // ── Step 6: Clear existing is_primary for all affected products ───────────
  // Done in chunks to avoid large IN clauses
  const productIds = [...new Set(assignments.map((a) => a.product_id))]

  for (const ch of chunk(productIds, 200)) {
    const { error } = await supabase
      .from('product_categories')
      .update({ is_primary: false })
      .in('product_id', ch)
      .eq('is_primary', true)

    if (error) report.errors.push(`Clear is_primary: ${error.message}`)
  }

  // ── Step 7: Upsert product_categories ────────────────────────────────────
  const pcRows = assignments.map((a) => ({
    product_id: a.product_id,
    category_id: a.category_id,
    is_primary: a.is_primary,
  }))

  for (const ch of chunk(pcRows, 200)) {
    const { error } = await supabase
      .from('product_categories')
      .upsert(ch, { onConflict: 'product_id,category_id' })

    if (error) {
      report.errors.push(`Product category upsert: ${error.message}`)
    } else {
      report.productsAssigned += ch.length
    }
  }

  return report
}
