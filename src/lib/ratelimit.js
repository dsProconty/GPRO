// Sliding window rate limiter (in-process, no external deps)
// Adequate for low-traffic internal apps; for high-traffic use @upstash/ratelimit + Redis.
// Each serverless instance has its own store — limits reset on cold starts.

const store = new Map()

// Returns true if the caller is rate-limited (should be blocked)
export function checkRateLimit(key, maxRequests = 10, windowMs = 60_000) {
  const now = Date.now()
  const record = store.get(key) ?? { count: 0, reset: now + windowMs }

  if (now > record.reset) {
    store.set(key, { count: 1, reset: now + windowMs })
    return false
  }

  if (record.count >= maxRequests) return true

  store.set(key, { ...record, count: record.count + 1 })

  // Prune store when it grows too large to prevent memory leaks
  if (store.size > 10_000) {
    for (const [k, v] of store) {
      if (now > v.reset) store.delete(k)
    }
  }

  return false
}
