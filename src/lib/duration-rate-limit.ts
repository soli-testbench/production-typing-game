// Duration-aware rate limiting: a 15s test can't be submitted more than once per 12 seconds, etc.
// This rate limiting is per-process and in-memory. In a multi-instance deployment,
// each process maintains its own independent rate limit state. Rate limits
// will NOT be shared across multiple server instances.

const durationRateLimitMap = new Map<string, number>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_AGE_MS = 120 * 1000; // 2 minutes
const SIZE_CLEANUP_THRESHOLD = 1000;

// Lazy cleanup bookkeeping. We avoid bare setInterval at module scope so we
// don't accumulate orphaned timers across serverless cold starts or Next.js
// HMR reloads. Instead, cleanup is piggy-backed on rate-limit checks: it
// fires either when the map grows beyond SIZE_CLEANUP_THRESHOLD or when at
// least CLEANUP_INTERVAL_MS has elapsed since the last cleanup.
let lastCleanupAt = 0;

// Minimum interval between submissions for each duration (in ms)
// A test of N seconds should not be submittable more than once per 80% of its duration
function getMinInterval(durationSeconds: number): number {
  return Math.floor(durationSeconds * 0.8) * 1000;
}

function cleanupExpiredEntries(now: number) {
  const keys = Array.from(durationRateLimitMap.keys());
  for (let i = 0; i < keys.length; i++) {
    const timestamp = durationRateLimitMap.get(keys[i]);
    if (timestamp && now - timestamp > MAX_AGE_MS) {
      durationRateLimitMap.delete(keys[i]);
    }
  }
}

function maybeCleanup(now: number) {
  if (
    durationRateLimitMap.size > SIZE_CLEANUP_THRESHOLD ||
    now - lastCleanupAt > CLEANUP_INTERVAL_MS
  ) {
    cleanupExpiredEntries(now);
    lastCleanupAt = now;
  }
}

export function checkDurationRateLimit(
  ip: string,
  durationSeconds: number,
  keyModifier?: string
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  // For word mode, callers pass a keyModifier (e.g. 'words-25') so the rate-limit
  // bucket is keyed by word count rather than the fractional completion time.
  // This prevents a cheater from bypassing the limit by varying the reported
  // duration slightly (12.4s vs 12.5s vs 12.6s).
  const key = `${ip}:${keyModifier ?? durationSeconds}`;

  // Lazy on-demand cleanup: piggy-backs on each rate-limit check so we do not
  // need a module-scope setInterval (which would leak across cold starts/HMR).
  maybeCleanup(now);

  const lastSubmission = durationRateLimitMap.get(key);
  const minInterval = getMinInterval(durationSeconds);

  if (lastSubmission && now - lastSubmission < minInterval) {
    const retryAfter = Math.ceil((minInterval - (now - lastSubmission)) / 1000);
    return { allowed: false, retryAfter };
  }

  durationRateLimitMap.set(key, now);
  return { allowed: true };
}
