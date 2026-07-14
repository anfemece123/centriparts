import { describe, expect, it } from 'vitest'
import {
  calculateImageLayout,
  clampImageOffset,
  validateProductImageFile,
} from './product-image-processing'

describe('product image processing helpers', () => {
  it('fills a square crop for a landscape image', () => {
    expect(calculateImageLayout({
      naturalWidth: 2000,
      naturalHeight: 1000,
      cropSize: 500,
      zoom: 1,
      fitMode: 'crop',
    })).toEqual({
      width: 1000,
      height: 500,
      maxOffsetX: 250,
      maxOffsetY: 0,
    })
  })

  it('keeps the complete image visible in contain mode', () => {
    expect(calculateImageLayout({
      naturalWidth: 2000,
      naturalHeight: 1000,
      cropSize: 500,
      zoom: 1,
      fitMode: 'contain',
    })).toEqual({
      width: 500,
      height: 250,
      maxOffsetX: 0,
      maxOffsetY: 0,
    })
  })

  it('clamps dragging to the visible crop boundaries', () => {
    expect(clampImageOffset(
      { x: 400, y: -80 },
      { width: 1000, height: 600, maxOffsetX: 250, maxOffsetY: 50 },
    )).toEqual({ x: 250, y: -50 })
  })

  it('rejects unsupported formats and oversized files', () => {
    expect(validateProductImageFile(new File(['x'], 'product.gif', { type: 'image/gif' })))
      .toBe('Formato no compatible. Utilice una imagen JPG, PNG o WebP.')

    const oversized = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'product.jpg', {
      type: 'image/jpeg',
    })
    expect(validateProductImageFile(oversized)).toBe('La imagen supera el límite de 25 MB.')
  })
})
