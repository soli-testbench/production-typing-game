// Rate limiting is per-process and in-memory. In a multi-instance deployment,
// each process maintains its own independent rate limit state. Rate limits
// will NOT be shared across multiple server instances.

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const SIZE_CLEANUP_THRESHOLD = 1000;

function cleanupExpiredEntries() {
  const now = Date.now();
  const keys = Array.from(rateLimitMap.keys());
  for (let i = 0; i < keys.length; i++) {
    const value = rateLimitMap.get(keys[i]);
    if (value && now > value.resetTime) {
      rateLimitMap.delete(keys[i]);
    }
  }
}

// Periodic cleanup every 5 minutes to evict stale entries
setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);

export function checkRateLimit(ip: string, maxRequests: number = MAX_REQUESTS): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `${ip}:${maxRequests}`;
  const record = rateLimitMap.get(key);

  // Secondary safeguard: clean up if map grows beyond threshold
  if (rateLimitMap.size > SIZE_CLEANUP_THRESHOLD) {
    cleanupExpiredEntries();
  }

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
