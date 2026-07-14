// SHA-256 helper built on the standard Web Crypto API, available as a
// global in both Deno (Edge Functions) and Node 19+ (Vitest).

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Re-wrapping guarantees an ArrayBuffer-backed view: newer TS DOM lib defs
  // type `crypto.subtle.digest`'s BufferSource as requiring `ArrayBuffer`
  // specifically, not the more general `ArrayBufferLike` a plain `Uint8Array`
  // parameter carries (it could in principle be backed by a SharedArrayBuffer).
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function sha256HexOfText(text: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(text))
}
