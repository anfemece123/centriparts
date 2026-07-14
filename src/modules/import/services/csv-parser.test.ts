import { describe, expect, it } from 'vitest'
import { mapRowToImportData, parseCsvText, validateCsvHeaders } from './csv-parser'

describe('CSV inventory header recovery', () => {
  it('recovers MARCA CARROS when Excel exports its header blank', () => {
    const csv = [
      'CI;PRODUCTO;TIPO;USO/MODELO;REFERENCIA;MARCA; PRECIO DE VENTA ;;COSTO INICIAL;STOCK',
      '1001-001;AUTOMATICO;12V;CHEVROLET SPARK;RM3698;IRAMAC;$ 95.000;CHEVROLET;$ 53.500;2',
    ].join('\n')

    const rows = parseCsvText(csv)

    expect(validateCsvHeaders(Object.keys(rows[0]))).toEqual({ valid: true, missing: [] })
    expect(mapRowToImportData(rows[0])).toMatchObject({
      ci: '1001-001',
      vehicle_brand_name: 'CHEVROLET',
      sale_price: 95_000,
      cost_price: 53_500,
      stock: 2,
    })
  })
})
