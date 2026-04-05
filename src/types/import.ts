export type ImportBatchStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type ImportRowStatus = 'pending' | 'imported' | 'updated' | 'skipped' | 'failed'

export interface ImportBatch {
  id: string
  filename: string
  status: ImportBatchStatus
  total_rows: number
  imported_count: number
  updated_count: number
  skipped_count: number
  failed_count: number
  imported_by: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ImportRow {
  id: string
  batch_id: string
  row_number: number
  ci: string | null
  raw_data: Record<string, string>
  status: ImportRowStatus
  product_id: string | null
  error_message: string | null
  processed_at: string | null
  created_at: string
}

// Raw CSV row shape — keys match CSV column headers exactly
export interface CsvRawRow {
  CI: string
  PRODUCTO: string
  TIPO: string
  REFERENCIA: string
  MARCA: string
  'MARCA CARROS': string
  'PRECIO DE VENTA': string
  'COSTO INICIAL': string
  STOCK: string
  'DESCRIPCION LARGA': string
  'USO/MODELO': string
  [key: string]: string
}

// Validated and typed data ready for product upsert
export interface ProductImportData {
  ci: string
  base_name: string
  reference: string | null
  description: string | null
  sale_price: number
  cost_price: number
  stock: number
  raw_compatibility: string | null
  product_type_name: string | null
  product_brand_name: string | null
  vehicle_brand_name: string | null
}

export interface ImportResult {
  batchId: string
  importedCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
}
