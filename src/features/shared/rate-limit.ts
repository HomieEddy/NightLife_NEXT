/**
 * In-memory token-bucket rate limiter. Each key gets a bucket that refills
 * at `refillRate` tokens per `windowMs`. Suitable for single-process
 * deployments; swap for Redis-backed when scaling horizontally.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterOptions {
  maxTokens: number;
  refillRate: number;
  windowMs: number;
}

const buckets = new Map<string, Bucket>();

const GC_INTERVAL = 60_000;
let gcTimer: ReturnType<typeof setInterval> | null = null;

function ensureGc(windowMs: number) {
  if (gcTimer) return;
  gcTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.lastRefill > windowMs * 2) buckets.delete(key);
    }
  }, GC_INTERVAL);
  if (typeof gcTimer === "object" && "unref" in gcTimer) gcTimer.unref();
}

export function checkRateLimit(
  key: string,
  opts: RateLimiterOptions,
): { allowed: boolean; retryAfterMs: number } {
  ensureGc(opts.windowMs);
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: opts.maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor((elapsed / opts.windowMs) * opts.refillRate);
  if (refill > 0) {
    bucket.tokens = Math.min(opts.maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  const msPerToken = opts.windowMs / opts.refillRate;
  return { allowed: false, retryAfterMs: Math.ceil(msPerToken) };
}

/** @internal — test helper */
export function _resetBuckets() {
  buckets.clear();
}
