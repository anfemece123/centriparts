import { describe, expect, it } from 'vitest'
import { buildImageSearchDocument, buildQuerySearchText } from './buildImageSearchDocument.ts'
import type { AutomotivePartImageAnalysis } from './types.ts'

describe('buildImageSearchDocument', () => {
  it('includes only the fields that are actually present', () => {
    const doc = buildImageSearchDocument({
      ci: '12345',
      productName: 'Bobina de encendido',
      brand: 'Bosch',
      type: 'Bobina lápiz',
      categoryPaths: ['Encendido > Bobinas'],
      reference: '0221504470',
      oemCodes: [],
      visualDescription: null,
      detectedText: [],
      materials: [],
      generalShape: 'cuerpo cilíndrico alargado',
      connectorType: 'rectangular',
      connectorCount: 4,
      mountingPoints: [],
      distinctiveFeatures: [],
      compatibilitySummary: [],
    })

    expect(doc).toContain('CI: 12345')
    expect(doc).toContain('Producto: Bobina de encendido')
    expect(doc).toContain('Marca: Bosch')
    expect(doc).toContain('Categorías: Encendido > Bobinas')
    expect(doc).toContain('Referencia: 0221504470')
    expect(doc).toContain('Conector: 4 pines rectangular')
    // Fields that were not supplied must never be fabricated in the output.
    expect(doc).not.toContain('OEM:')
    expect(doc).not.toContain('Material:')
    expect(doc).not.toContain('Descripción visual:')
  })

  it('always includes CI and product name — required identity fields', () => {
    const doc = buildImageSearchDocument({
      ci: '999',
      productName: 'Filtro de aceite',
      brand: null,
      type: null,
      categoryPaths: [],
      reference: null,
      oemCodes: [],
      visualDescription: null,
      detectedText: [],
      materials: [],
      generalShape: null,
      connectorType: null,
      connectorCount: null,
      mountingPoints: [],
      distinctiveFeatures: [],
      compatibilitySummary: [],
    })
    expect(doc).toBe('CI: 999\nProducto: Filtro de aceite')
  })
})

function baseAnalysis(overrides: Partial<AutomotivePartImageAnalysis> = {}): AutomotivePartImageAnalysis {
  return {
    isAutomotivePart: true,
    imageQuality: 'good',
    viewAngle: null,
    partType: null,
    categoryGuess: null,
    brandVisible: null,
    manufacturerVisible: null,
    referenceCodes: [],
    oemCodes: [],
    barcodes: [],
    printedText: [],
    materials: [],
    colors: [],
    generalShape: null,
    connectorCount: null,
    connectorType: null,
    mountingPoints: [],
    holesAndThreads: [],
    distinctiveFeatures: [],
    visibleDamageOrWear: [],
    searchDescription: '',
    warnings: [],
    ...overrides,
  }
}

describe('buildQuerySearchText', () => {
  it('never includes a CI or product name (the query has no catalog identity)', () => {
    const text = buildQuerySearchText(baseAnalysis({ partType: 'Bobina', brandVisible: 'Bosch' }), 'Bobinas')
    expect(text).toContain('Categoría de búsqueda: Bobinas')
    expect(text).toContain('Tipo: Bobina')
    expect(text).toContain('Marca: Bosch')
    expect(text).not.toMatch(/^CI:/m)
  })

  it('omits the category line entirely when search is global', () => {
    const text = buildQuerySearchText(baseAnalysis(), null)
    expect(text).not.toContain('Categoría de búsqueda')
  })
})
