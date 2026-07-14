export interface RateLimitPort {
  countRecentEventsByIpHash(ipHash: string, sinceIso: string): Promise<number>
}

export interface RateLimitParams {
  ipHash: string | null
  windowMs: number
  maxRequests: number
}

/** Best-effort abuse protection: not a substitute for infra-level rate limiting. */
export async function isRateLimited(params: RateLimitParams, port: RateLimitPort): Promise<boolean> {
  if (!params.ipHash) return false
  const sinceIso = new Date(Date.now() - params.windowMs).toISOString()
  const count = await port.countRecentEventsByIpHash(params.ipHash, sinceIso)
  return count >= params.maxRequests
}
