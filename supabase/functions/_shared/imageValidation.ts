// Validates uploaded images before they are sent anywhere (spec section 19).

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export interface ImageValidationInput {
  mimeType: string
  sizeBytes: number
}

export type ImageValidationErrorCode = 'invalid_file' | 'file_too_large'

export interface ImageValidationResult {
  valid: boolean
  errorCode: ImageValidationErrorCode | null
}

export function validateUploadedImage(
  input: ImageValidationInput,
  maxFileMb: number,
): ImageValidationResult {
  if (!input.mimeType || input.sizeBytes <= 0) {
    return { valid: false, errorCode: 'invalid_file' }
  }
  if (!ALLOWED_MIME_TYPES.has(input.mimeType.toLowerCase())) {
    return { valid: false, errorCode: 'invalid_file' }
  }

  const maxBytes = maxFileMb * 1024 * 1024
  if (input.sizeBytes > maxBytes) {
    return { valid: false, errorCode: 'file_too_large' }
  }

  return { valid: true, errorCode: null }
}
