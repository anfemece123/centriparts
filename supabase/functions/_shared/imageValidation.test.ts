import { describe, expect, it } from 'vitest'
import { validateUploadedImage } from './imageValidation.ts'

describe('validateUploadedImage', () => {
  it('accepts a well-formed JPEG under the size limit', () => {
    expect(validateUploadedImage({ mimeType: 'image/jpeg', sizeBytes: 2_000_000 }, 8)).toEqual({
      valid: true,
      errorCode: null,
    })
  })

  it('rejects an empty file', () => {
    expect(validateUploadedImage({ mimeType: 'image/jpeg', sizeBytes: 0 }, 8).errorCode).toBe('invalid_file')
  })

  it('rejects a disallowed mime type (not an image)', () => {
    expect(validateUploadedImage({ mimeType: 'application/pdf', sizeBytes: 1000 }, 8).errorCode).toBe('invalid_file')
  })

  it('rejects a file that is too large', () => {
    const tenMb = 10 * 1024 * 1024
    expect(validateUploadedImage({ mimeType: 'image/png', sizeBytes: tenMb }, 8).errorCode).toBe('file_too_large')
  })

  it('accepts a file exactly at the size limit', () => {
    const eightMb = 8 * 1024 * 1024
    expect(validateUploadedImage({ mimeType: 'image/png', sizeBytes: eightMb }, 8).valid).toBe(true)
  })
})
