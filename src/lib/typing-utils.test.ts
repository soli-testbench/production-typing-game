import { describe, it, expect } from 'vitest';
import { calculateWpm, calculateRawWpm, calculateAccuracy } from './typing-utils';

describe('calculateWpm', () => {
  it('returns 0 when correctChars is 0', () => {
    expect(calculateWpm(0, 60)).toBe(0);
  });

  it('returns 0 when correctChars is negative', () => {
    expect(calculateWpm(-10, 60)).toBe(0);
  });

  it('returns 0 when elapsedSeconds is 0', () => {
    expect(calculateWpm(100, 0)).toBe(0);
  });

  it('returns 0 when elapsedSeconds is negative', () => {
    expect(calculateWpm(100, -5)).toBe(0);
  });

  it('returns 0 when correctChars is NaN', () => {
    expect(calculateWpm(Number.NaN, 60)).toBe(0);
  });

  it('returns 0 when elapsedSeconds is NaN', () => {
    expect(calculateWpm(100, Number.NaN)).toBe(0);
  });

  it('returns 0 when correctChars is Infinity', () => {
    expect(calculateWpm(Number.POSITIVE_INFINITY, 60)).toBe(0);
  });

  it('returns 0 when elapsedSeconds is Infinity', () => {
    expect(calculateWpm(100, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('returns 0 when elapsedSeconds is -Infinity', () => {
    expect(calculateWpm(100, Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('clamps sub-1-second durations to 1 second', () => {
    // 300 chars in 0.5s would be a ridiculous 7200 WPM without clamping;
    // with the 1-second floor it must be (300/5)/(1/60) = 3600.
    expect(calculateWpm(300, 0.5)).toBe(3600);
    // Identical result for 0.1s — any value below 1 is treated as 1.
    expect(calculateWpm(300, 0.1)).toBe(3600);
  });

  it('computes standard 60 WPM for 300 correct chars in 60 seconds', () => {
    // 300 chars / 5 = 60 "words"; over 1 minute this is exactly 60 WPM.
    expect(calculateWpm(300, 60)).toBe(60);
  });

  it('computes 80 WPM for 200 chars in 30 seconds', () => {
    // (200/5) / (30/60) = 40 / 0.5 = 80 WPM.
    expect(calculateWpm(200, 30)).toBe(80);
  });

  it('rounds to nearest integer', () => {
    // (13/5) / (10/60) = 2.6 / (1/6) = 15.6 → rounds to 16.
    expect(calculateWpm(13, 10)).toBe(16);
  });

  it('is exactly 1 for boundary case of 5 correct chars in 60s', () => {
    // 5 chars = 1 word over 1 minute → 1 WPM.
    expect(calculateWpm(5, 60)).toBe(1);
  });

  it('handles very large correctChars without overflow', () => {
    expect(calculateWpm(1_000_000, 60)).toBe(200000);
  });
});

describe('calculateRawWpm', () => {
  it('returns 0 when totalChars is 0', () => {
    expect(calculateRawWpm(0, 60)).toBe(0);
  });

  it('returns 0 when totalChars is negative', () => {
    expect(calculateRawWpm(-10, 60)).toBe(0);
  });

  it('returns 0 when totalChars is NaN', () => {
    expect(calculateRawWpm(Number.NaN, 60)).toBe(0);
  });

  it('returns 0 when elapsedSeconds is NaN', () => {
    expect(calculateRawWpm(100, Number.NaN)).toBe(0);
  });

  it('returns 0 when totalChars is Infinity', () => {
    expect(calculateRawWpm(Number.POSITIVE_INFINITY, 60)).toBe(0);
  });

  it('returns 0 when elapsedSeconds is Infinity', () => {
    expect(calculateRawWpm(100, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('returns 0 when elapsedSeconds is 0', () => {
    expect(calculateRawWpm(100, 0)).toBe(0);
  });

  it('returns 0 when elapsedSeconds is negative', () => {
    expect(calculateRawWpm(100, -1)).toBe(0);
  });

  it('clamps sub-1-second durations to 1 second', () => {
    expect(calculateRawWpm(300, 0.5)).toBe(3600);
  });

  it('computes 60 raw WPM for 300 chars in 60 seconds', () => {
    expect(calculateRawWpm(300, 60)).toBe(60);
  });

  it('upper-bounds calculateWpm for the same time window', () => {
    // Raw includes incorrect chars, so rawWpm >= wpm for the same elapsed.
    const total = 400;
    const correct = 350;
    const elapsed = 60;
    const raw = calculateRawWpm(total, elapsed);
    const net = calculateWpm(correct, elapsed);
    expect(raw).toBeGreaterThanOrEqual(net);
  });

  it('rounds to nearest integer', () => {
    // (13/5) / (10/60) = 15.6 → 16.
    expect(calculateRawWpm(13, 10)).toBe(16);
  });
});

describe('calculateAccuracy', () => {
  it('returns 100 when total is 0 (no input yet)', () => {
    expect(calculateAccuracy(0, 0)).toBe(100);
  });

  it('returns 100 when total is negative', () => {
    expect(calculateAccuracy(0, -1)).toBe(100);
  });

  it('returns 100 when total is NaN', () => {
    expect(calculateAccuracy(0, Number.NaN)).toBe(100);
  });

  it('returns 100 when total is Infinity', () => {
    expect(calculateAccuracy(100, Number.POSITIVE_INFINITY)).toBe(100);
  });

  it('returns 0 when correct is negative', () => {
    expect(calculateAccuracy(-5, 100)).toBe(0);
  });

  it('returns 0 when correct is NaN', () => {
    expect(calculateAccuracy(Number.NaN, 100)).toBe(0);
  });

  it('returns 0 when correct is Infinity', () => {
    expect(calculateAccuracy(Number.POSITIVE_INFINITY, 100)).toBe(0);
  });

  it('returns 100 for perfect input', () => {
    expect(calculateAccuracy(50, 50)).toBe(100);
  });

  it('returns 0 for completely wrong input', () => {
    expect(calculateAccuracy(0, 50)).toBe(0);
  });

  it('clamps correct > total to 100 (defensive upper bound)', () => {
    expect(calculateAccuracy(150, 100)).toBe(100);
  });

  it('computes 50% for half-correct input', () => {
    expect(calculateAccuracy(25, 50)).toBe(50);
  });

  it('rounds to nearest integer', () => {
    // 1/3 = 33.33...% → rounds to 33
    expect(calculateAccuracy(1, 3)).toBe(33);
    // 2/3 = 66.66...% → rounds to 67
    expect(calculateAccuracy(2, 3)).toBe(67);
  });

  it('returns 99 for 99 correct out of 100 (boundary)', () => {
    expect(calculateAccuracy(99, 100)).toBe(99);
  });

  it('returns 1 for 1 correct out of 100 (boundary)', () => {
    expect(calculateAccuracy(1, 100)).toBe(1);
  });
});
