import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// The rate-limit module maintains an in-memory Map at module scope, so we
// reset modules before each test to get an isolated state. This is cleaner
// than trying to export an internal reset helper.
async function loadFreshModule() {
  vi.resetModules();
  return import('./rate-limit');
}

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first request from an IP', async () => {
    const { checkRateLimit } = await loadFreshModule();
    const result = checkRateLimit('1.1.1.1');
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('allows requests up to the default max (10) within the window', async () => {
    const { checkRateLimit } = await loadFreshModule();
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit('1.1.1.1').allowed).toBe(true);
    }
  });

  it('blocks the 11th request from the same IP within the window', async () => {
    const { checkRateLimit } = await loadFreshModule();
    for (let i = 0; i < 10; i++) checkRateLimit('1.1.1.1');
    const blocked = checkRateLimit('1.1.1.1');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    // retryAfter is ceil of remaining-ms / 1000; with a fresh window the
    // value should be no larger than the full 60s window.
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it('respects a custom maxRequests argument', async () => {
    const { checkRateLimit } = await loadFreshModule();
    expect(checkRateLimit('2.2.2.2', 2).allowed).toBe(true);
    expect(checkRateLimit('2.2.2.2', 2).allowed).toBe(true);
    const blocked = checkRateLimit('2.2.2.2', 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('isolates rate-limit buckets per IP', async () => {
    const { checkRateLimit } = await loadFreshModule();
    for (let i = 0; i < 10; i++) checkRateLimit('3.3.3.3');
    // Different IP should still be allowed
    expect(checkRateLimit('4.4.4.4').allowed).toBe(true);
    // Original IP should be blocked
    expect(checkRateLimit('3.3.3.3').allowed).toBe(false);
  });

  it('isolates rate-limit buckets per maxRequests argument (key includes max)', async () => {
    const { checkRateLimit } = await loadFreshModule();
    // Exhaust the bucket for maxRequests=2
    expect(checkRateLimit('5.5.5.5', 2).allowed).toBe(true);
    expect(checkRateLimit('5.5.5.5', 2).allowed).toBe(true);
    expect(checkRateLimit('5.5.5.5', 2).allowed).toBe(false);
    // A different maxRequests value uses a different bucket and should be
    // independently allowed.
    expect(checkRateLimit('5.5.5.5', 5).allowed).toBe(true);
  });

  it('resets after the 60-second window elapses', async () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const { checkRateLimit } = await loadFreshModule();
    for (let i = 0; i < 10; i++) checkRateLimit('6.6.6.6');
    expect(checkRateLimit('6.6.6.6').allowed).toBe(false);

    // Advance the clock past the 60s window
    vi.setSystemTime(new Date('2025-01-01T00:01:01Z'));
    expect(checkRateLimit('6.6.6.6').allowed).toBe(true);
  });

  it('returns a retryAfter that shrinks as time progresses within the window', async () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const { checkRateLimit } = await loadFreshModule();
    for (let i = 0; i < 10; i++) checkRateLimit('7.7.7.7');
    const first = checkRateLimit('7.7.7.7');
    expect(first.allowed).toBe(false);
    const firstRetry = first.retryAfter!;

    // Advance 30s into the window; retryAfter must be strictly smaller.
    vi.setSystemTime(new Date('2025-01-01T00:00:30Z'));
    const second = checkRateLimit('7.7.7.7');
    expect(second.allowed).toBe(false);
    expect(second.retryAfter!).toBeLessThan(firstRetry);
  });
});
