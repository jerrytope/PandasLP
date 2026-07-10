// Best-effort, in-memory rate limiting shared by /api/chat and /api/extract — both call
// out to the Anthropic API and are reachable without auth, so an unbounded client could
// otherwise run up the API bill for free.
//
// This is per-instance, not a global guarantee: a serverless/edge deployment can run
// multiple warm instances, each with its own bucket map, so a determined attacker
// spreading requests across instances/regions could exceed the stated limit. It still
// stops the realistic case — a single script hammering the endpoint from one connection —
// without requiring a new external service. If this project ever needs a hard global cap,
// swap this module for Upstash Redis or Vercel KV; every call site here goes through
// checkRateLimit() so the swap is contained to this one file.

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
let lastSweep = Date.now()

function sweepExpired(now: number) {
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key)
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  sweepExpired(now)

  const existing = buckets.get(key)
  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) }
  }

  existing.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
