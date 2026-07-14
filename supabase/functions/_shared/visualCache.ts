// Cache key + TTL helpers for visual_search_cache (spec section 23). The
// actual table read/write lives in the DB port (Deno-only, untested
// directly per the existing supabaseSearchPort.ts convention) — this file
// holds the pure, testable logic: what goes into the key, and how long a
// cached response is valid for.

import { sha256HexOfText } from './hash.ts'

export interface VisualSearchCacheKeyInput {
  queryImageSha256: string
  categoryId: string | null
  provider: string
  model: string
  modelVersion: string
  preprocessingVersion: string
  rankingVersion: string
}

/** Deterministic — same inputs always produce the same key, so a repeated
 * search (same photo, same category, same active model/ranking version)
 * is a guaranteed cache hit, and any version bump is a guaranteed miss. */
export function buildVisualSearchCacheKey(input: VisualSearchCacheKeyInput): Promise<string> {
  const raw = [
    input.queryImageSha256,
    input.categoryId ?? 'global',
    input.provider,
    input.model,
    input.modelVersion,
    input.preprocessingVersion,
    input.rankingVersion,
  ].join('|')
  return sha256HexOfText(raw)
}

export function computeCacheExpiry(ttlMinutes: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + ttlMinutes * 60_000)
}

export function isCacheExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime()
}
