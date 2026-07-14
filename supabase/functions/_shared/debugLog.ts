// Diagnostic logging gated by VISUAL_SEARCH_DEBUG (default: off — spec
// section 10). The payload shape is deliberately narrow: it structurally
// cannot carry an image, base64, embedding, signed URL, key, or token,
// because those fields simply don't exist on DebugLogEntry. Don't widen
// this type with a catch-all `data: unknown` — that would reopen the door
// to accidentally logging something sensitive.

export interface DebugLogEntry {
  stage: string
  durationMs?: number
  categoryId?: string | null
  includedCategoryCount?: number
  isGlobalSearch?: boolean
  candidatesRetrieved?: number
  candidatesReranked?: number
  status?: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
}

export function debugLog(enabled: boolean, searchId: string, entry: DebugLogEntry): void {
  if (!enabled) return
  console.log(`[visual-search:debug:${searchId}]`, JSON.stringify(entry))
}
