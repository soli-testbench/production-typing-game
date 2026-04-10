const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10;

export function checkRateLimit(ip: string, maxRequests: number = MAX_REQUESTS): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `${ip}:${maxRequests}`;
  const record = rateLimitMap.get(key);

  // Clean up expired entries periodically
  if (rateLimitMap.size > 10000) {
    const keys = Array.from(rateLimitMap.keys());
    for (let i = 0; i < keys.length; i++) {
      const value = rateLimitMap.get(keys[i]);
      if (value && now > value.resetTime) {
        rateLimitMap.delete(keys[i]);
      }
    }
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
