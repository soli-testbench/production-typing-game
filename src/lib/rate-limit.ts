// Rate limiting is per-process and in-memory. In a multi-instance deployment,
// each process maintains its own independent rate limit state. Rate limits
// will NOT be shared across multiple server instances.

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SIZE_CLEANUP_THRESHOLD = 1000;

// Lazy cleanup bookkeeping. We avoid bare setInterval at module scope so we
// don't accumulate orphaned timers across serverless cold starts or Next.js
// HMR reloads. Instead, cleanup is piggy-backed on rate-limit checks: it
// fires either when the map grows beyond SIZE_CLEANUP_THRESHOLD or when at
// least CLEANUP_INTERVAL_MS has elapsed since the last cleanup.
let lastCleanupAt = 0;

function cleanupExpiredEntries(now: number) {
  const keys = Array.from(rateLimitMap.keys());
  for (let i = 0; i < keys.length; i++) {
    const value = rateLimitMap.get(keys[i]);
    if (value && now > value.resetTime) {
      rateLimitMap.delete(keys[i]);
    }
  }
}

function maybeCleanup(now: number) {
  if (
    rateLimitMap.size > SIZE_CLEANUP_THRESHOLD ||
    now - lastCleanupAt > CLEANUP_INTERVAL_MS
  ) {
    cleanupExpiredEntries(now);
    lastCleanupAt = now;
  }
}

export function checkRateLimit(ip: string, maxRequests: number = MAX_REQUESTS): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `${ip}:${maxRequests}`;

  // Lazy on-demand cleanup: piggy-backs on each rate-limit check so we do not
  // need a module-scope setInterval (which would leak across cold starts/HMR).
  maybeCleanup(now);

  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}
