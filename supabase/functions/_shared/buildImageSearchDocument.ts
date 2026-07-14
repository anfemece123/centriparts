// Builds the canonical text document used to generate the embedding for a
// product image (spec section 9). Only fields that are actually present
// are included — never fabricate or infer missing data.

export interface SearchDocumentInput {
  ci: string
  productName: string
  brand: string | null
  type: string | null
  /** e.g. ["Encendido > Bobinas"] — hierarchical path per assigned category. */
  categoryPaths: string[]
  reference: string | null
  oemCodes: string[]
  visualDescription: string | null
  detectedText: string[]
  materials: string[]
  generalShape: string | null
  connectorType: string | null
  connectorCount: number | null
  mountingPoints: string[]
  distinctiveFeatures: string[]
  /** Secondary weight: appended last, kept brief. */
  compatibilitySummary: string[]
}

import type { AutomotivePartImageAnalysis } from './types.ts'

/**
 * Builds the text used to embed the *query* photo (Etapa B, step 9) — same
 * spirit as buildImageSearchDocument but without a CI/product name, since
 * the query has no catalog identity yet.
 */
export function buildQuerySearchText(
  analysis: AutomotivePartImageAnalysis,
  categoryContext: string | null,
): string {
  const lines: string[] = []
  if (categoryContext) lines.push(`Categoría de búsqueda: ${categoryContext}`)
  if (analysis.partType) lines.push(`Tipo: ${analysis.partType}`)
  if (analysis.brandVisible) lines.push(`Marca: ${analysis.brandVisible}`)
  if (analysis.manufacturerVisible) lines.push(`Fabricante: ${analysis.manufacturerVisible}`)
  if (analysis.referenceCodes.length > 0) lines.push(`Referencia: ${analysis.referenceCodes.join(', ')}`)
  if (analysis.oemCodes.length > 0) lines.push(`OEM: ${analysis.oemCodes.join(', ')}`)

  const connectorParts = [
    analysis.connectorCount !== null ? `${analysis.connectorCount} pines` : null,
    analysis.connectorType,
  ].filter((v): v is string => Boolean(v))
  if (connectorParts.length > 0) lines.push(`Conector: ${connectorParts.join(' ')}`)

  if (analysis.generalShape) lines.push(`Forma: ${analysis.generalShape}`)
  if (analysis.materials.length > 0) lines.push(`Material: ${analysis.materials.join(', ')}`)
  if (analysis.mountingPoints.length > 0) lines.push(`Montaje: ${analysis.mountingPoints.join(', ')}`)
  if (analysis.distinctiveFeatures.length > 0) {
    lines.push(`Características: ${analysis.distinctiveFeatures.join(', ')}`)
  }
  if (analysis.printedText.length > 0) lines.push(`Texto detectado: ${analysis.printedText.join(', ')}`)
  if (analysis.searchDescription) lines.push(`Descripción visual: ${analysis.searchDescription}`)

  return lines.join('\n')
}

export function buildImageSearchDocument(input: SearchDocumentInput): string {
  const lines: string[] = []

  lines.push(`CI: ${input.ci}`)
  lines.push(`Producto: ${input.productName}`)
  if (input.brand) lines.push(`Marca: ${input.brand}`)
  if (input.type) lines.push(`Tipo: ${input.type}`)
  if (input.categoryPaths.length > 0) lines.push(`Categorías: ${input.categoryPaths.join(' | ')}`)
  if (input.reference) lines.push(`Referencia: ${input.reference}`)
  if (input.oemCodes.length > 0) lines.push(`OEM: ${input.oemCodes.join(', ')}`)

  const connectorParts = [
    input.connectorCount !== null ? `${input.connectorCount} pines` : null,
    input.connectorType,
  ].filter((v): v is string => Boolean(v))
  if (connectorParts.length > 0) lines.push(`Conector: ${connectorParts.join(' ')}`)

  if (input.generalShape) lines.push(`Forma: ${input.generalShape}`)
  if (input.materials.length > 0) lines.push(`Material: ${input.materials.join(', ')}`)
  if (input.mountingPoints.length > 0) lines.push(`Montaje: ${input.mountingPoints.join(', ')}`)
  if (input.distinctiveFeatures.length > 0) lines.push(`Características: ${input.distinctiveFeatures.join(', ')}`)
  if (input.detectedText.length > 0) lines.push(`Texto detectado: ${input.detectedText.join(', ')}`)
  if (input.visualDescription) lines.push(`Descripción visual: ${input.visualDescription}`)
  if (input.compatibilitySummary.length > 0) lines.push(`Compatibilidad: ${input.compatibilitySummary.join('; ')}`)

  return lines.join('\n')
}
