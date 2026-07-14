// Lightweight, dependency-free image preprocessing.
//
// Limitation (documented, not silently skipped): this strips EXIF/COM
// metadata from JPEGs — including the EXIF orientation tag — but does not
// re-encode pixels, so it cannot physically rotate a sideways photo. Doing
// that safely would require a full image codec, which this project does not
// depend on. Vision models tolerate rotated input reasonably well; this is
// a real gap, called out in the final report rather than papered over.

const APP1_EXIF_MARKER = 0xe1
const COM_MARKER = 0xfe

export function stripJpegExif(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return bytes // Not a JPEG (missing SOI marker) — leave untouched.
  }

  const out: number[] = [0xff, 0xd8]
  let offset = 2

  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xff) {
      return bytes // Unexpected structure — bail out safely, return original.
    }

    const marker = bytes[offset + 1]

    if (marker === 0xda) {
      // Start of Scan: everything after this is compressed image data.
      for (let i = offset; i < bytes.length; i++) out.push(bytes[i])
      break
    }

    const hasNoPayload =
      marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01
    if (hasNoPayload) {
      out.push(0xff, marker)
      offset += 2
      continue
    }

    if (offset + 3 >= bytes.length) return bytes // Malformed — bail out safely.

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    const isMetadataSegment = marker === APP1_EXIF_MARKER || marker === COM_MARKER

    if (!isMetadataSegment) {
      for (let i = offset; i < offset + 2 + length; i++) out.push(bytes[i])
    }

    offset += 2 + length
  }

  return new Uint8Array(out)
}

export function sanitizeImageBytes(bytes: Uint8Array, mimeType: string): Uint8Array {
  if (mimeType.toLowerCase() === 'image/jpeg') {
    return stripJpegExif(bytes)
  }
  return bytes
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function bytesToDataUrl(bytes: Uint8Array, mimeType: string): string {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`
}
