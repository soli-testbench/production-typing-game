import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

async function loadFreshModule() {
  vi.resetModules();
  return import('./duration-rate-limit');
}

describe('checkDurationRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first submission for a given duration', async () => {
    const { checkDurationRateLimit } = await loadFreshModule();
    const result = checkDurationRateLimit('1.1.1.1', 15);
    expect(result.allowed).toBe(true);
    expect(result.retryAfter).toBeUndefined();
  });

  it('blocks a second 15s submission within the 12s min interval', async () => {
    const { checkDurationRateLimit } = await loadFreshModule();
    expect(checkDurationRateLimit('1.1.1.1', 15).allowed).toBe(true);
    // 15s * 0.8 = 12s min interval. Immediate re-submission must be blocked.
    const blocked = checkDurationRateLimit('1.1.1.1', 15);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(12);
  });

  it('returns the correct retryAfter for 30s tests (24s min interval)', async () => {
    const { checkDurationRateLimit } = await loadFreshModule();
    checkDurationRateLimit('1.1.1.1', 30);
    const blocked = checkDurationRateLimit('1.1.1.1', 30);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(24);
  });

  it('returns the correct retryAfter for 60s tests (48s min interval)', async () => {
    const { checkDurationRateLimit } = await loadFreshModule();
    checkDurationRateLimit('1.1.1.1', 60);
    const blocked = checkDurationRateLimit('1.1.1.1', 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(48);
  });

  it('returns the correct retryAfter for 120s tests (96s min interval)', async () => {
    const { checkDurationRateLimit } = await loadFreshModule();
    checkDurationRateLimit('1.1.1.1', 120);
    const blocked = checkDurationRateLimit('1.1.1.1', 120);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(96);
  });

  it('allows a second submission once the min interval has fully elapsed', async () => {
    const { checkDurationRateLimit } = await loadFreshModule();
    checkDurationRateLimit('1.1.1.1', 15);
    // Advance 12 seconds — exactly at the boundary, should be allowed again.
    vi.setSystemTime(new Date('2025-01-01T00:00:12Z'));
    const second = checkDurationRateLimit('1.1.1.1', 15);
    expect(second.allowed).toBe(true);
  });

  it('still blocks when just under the min interval', async () => {
    const { checkDurationRateLimit } = await loadFreshModule();
    checkDurationRateLimit('1.1.1.1', 15);
    // Advance 11.9s — still inside the 12s window, must still be blocked.
    vi.setSystemTime(new Date('2025-01-01T00:00:11.900Z'));
    const second = checkDurationRateLimit('1.1.1.1', 15);
    expect(second.allowed).toBe(false);
    expect(second.retryAfter).toBeGreaterThan(0);
    expect(second.retryAfter).toBeLessThanOrEqual(1);
  });

  it('isolates buckets per IP', async () => {
    const { checkDurationRateLimit } = await loadFreshModule();
    checkDurationRateLimit('1.1.1.1', 15);
    // Different IP uses a different bucket.
    expect(checkDurationRateLimit('9.9.9.9', 15).allowed).toBe(true);
    // Original IP is still blocked.
    expect(checkDurationRateLimit('1.1.1.1', 15).allowed).toBe(false);
  });

  it('isolates buckets per duration (15s vs 60s for same IP)', async () => {
    const { checkDurationRateLimit } = await loadFreshModule();
    checkDurationRateLimit('2.2.2.2', 15);
    // Same IP but a different duration is a different bucket.
    expect(checkDurationRateLimit('2.2.2.2', 60).allowed).toBe(true);
  });

  it('supports a custom keyModifier to collapse varying durations into one bucket', async () => {
    const { checkDurationRateLimit } = await loadFreshModule();
    // Simulate word mode, where the "duration" is the fractional completion
    // time but we want to bucket by word count. First submission completes
    // a 25-word test in 12.4s...
    const first = checkDurationRateLimit('3.3.3.3', 12.4, 'words-25');
    expect(first.allowed).toBe(true);

    // A fraction of a second later the user tries to submit another
    // "completion" of the same 25-word test — a slightly different fractional
    // duration (12.6s) would create a different bucket without the
    // keyModifier, but with it, the bucket is shared and the submission
    // must be blocked.
    vi.setSystemTime(new Date('2025-01-01T00:00:00.500Z'));
    const blocked = checkDurationRateLimit('3.3.3.3', 12.6, 'words-25');
    expect(blocked.allowed).toBe(false);
    // 12.6 * 0.8 = 10.08s -> floored to 10s min interval. Elapsed is 0.5s,
    // so retryAfter should be ceil((10 - 0.5)) = 10.
    expect(blocked.retryAfter).toBe(10);
  });

  it('keyModifier isolates word counts: 25-word test does not block 50-word submission', async () => {
    const { checkDurationRateLimit } = await loadFreshModule();
    checkDurationRateLimit('4.4.4.4', 12.4, 'words-25');
    // Different keyModifier for a different word count: independent bucket.
    expect(checkDurationRateLimit('4.4.4.4', 25, 'words-50').allowed).toBe(true);
  });
});
