// Duration-aware rate limiting: a 15s test can't be submitted more than once per 12 seconds, etc.
const durationRateLimitMap = new Map<string, number>();

// Minimum interval between submissions for each duration (in ms)
// A test of N seconds should not be submittable more than once per 80% of its duration
function getMinInterval(durationSeconds: number): number {
  return Math.floor(durationSeconds * 0.8) * 1000;
}

export function checkDurationRateLimit(
  ip: string,
  durationSeconds: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `${ip}:${durationSeconds}`;
  const lastSubmission = durationRateLimitMap.get(key);
  const minInterval = getMinInterval(durationSeconds);

  // Clean up expired entries periodically
  if (durationRateLimitMap.size > 10000) {
    const maxAge = 120 * 1000; // 2 minutes
    const keys = Array.from(durationRateLimitMap.keys());
    for (let i = 0; i < keys.length; i++) {
      const timestamp = durationRateLimitMap.get(keys[i]);
      if (timestamp && now - timestamp > maxAge) {
        durationRateLimitMap.delete(keys[i]);
      }
    }
  }

  if (lastSubmission && now - lastSubmission < minInterval) {
    const retryAfter = Math.ceil((minInterval - (now - lastSubmission)) / 1000);
    return { allowed: false, retryAfter };
  }

  durationRateLimitMap.set(key, now);
  return { allowed: true };
}
