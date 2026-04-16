import { describe, it, expect } from 'vitest';
import { sanitizeName, isValidPlayerName, MAX_PLAYER_NAME_LENGTH } from './sanitize-name';

describe('sanitizeName', () => {
  it('returns an empty string for non-string input', () => {
    expect(sanitizeName(undefined)).toBe('');
    expect(sanitizeName(null)).toBe('');
    expect(sanitizeName(42)).toBe('');
    expect(sanitizeName({})).toBe('');
  });

  it('returns an empty string for an empty input', () => {
    expect(sanitizeName('')).toBe('');
  });

  it('trims leading and trailing whitespace before any other step', () => {
    expect(sanitizeName('   alice   ')).toBe('alice');
    expect(sanitizeName('\t bob \n')).toBe('bob');
  });

  it('strips invalid characters but keeps letters, digits, and spaces', () => {
    expect(sanitizeName('a!b@c#')).toBe('abc');
    expect(sanitizeName('hello world')).toBe('hello world');
    expect(sanitizeName('mix 123 abc')).toBe('mix 123 abc');
  });

  it('returns an empty string when the input contains only special chars', () => {
    expect(sanitizeName('!@#$%^&*()')).toBe('');
    expect(sanitizeName('💥🔥')).toBe('');
    expect(sanitizeName('   ---   ')).toBe('');
  });

  it('truncates to 20 characters', () => {
    const input = 'abcdefghijklmnopqrstuvwxyz';
    const out = sanitizeName(input);
    expect(out).toBe('abcdefghijklmnopqrst');
    expect(out.length).toBe(MAX_PLAYER_NAME_LENGTH);
  });

  it('trims trailing spaces that survive the slice at exactly 20 characters', () => {
    // 17 chars + 3 trailing spaces = exactly 20, after slice the result
    // would still have trailing spaces, which must be trimmed.
    const input = 'seventeenchars123   ';
    expect(input.length).toBe(20);
    const out = sanitizeName(input);
    expect(out).toBe('seventeenchars123');
    expect(out.endsWith(' ')).toBe(false);
  });

  it('handles a 20-char name with invalid chars that get stripped mid-stream', () => {
    // Invalid chars are removed first, so the effective length is measured
    // against the cleaned string, not the original input.
    const input = 'a!b@c#d$e%f^g&h*i(j)1234567890';
    const out = sanitizeName(input);
    expect(out).toBe('abcdefghij1234567890');
    expect(out.length).toBe(20);
  });

  it('is idempotent: sanitizing an already-sanitized name returns the same value', () => {
    const once = sanitizeName('  Hello 42  ');
    const twice = sanitizeName(once);
    expect(once).toBe('Hello 42');
    expect(twice).toBe(once);
  });

  it('produces the same result regardless of surrounding whitespace + special chars', () => {
    expect(sanitizeName('  !Alice!  ')).toBe('Alice');
    expect(sanitizeName('Alice')).toBe('Alice');
  });

  it('preserves internal single spaces between words', () => {
    expect(sanitizeName('foo bar baz')).toBe('foo bar baz');
  });

  it('returns the empty string after sanitization for pure-whitespace input', () => {
    expect(sanitizeName('     ')).toBe('');
    expect(sanitizeName('\n\t\r')).toBe('');
  });
});

describe('isValidPlayerName', () => {
  it('returns true for names that survive sanitization', () => {
    expect(isValidPlayerName('alice')).toBe(true);
    expect(isValidPlayerName('  bob  ')).toBe(true);
    expect(isValidPlayerName('a1')).toBe(true);
  });

  it('returns false for names that sanitize to the empty string', () => {
    expect(isValidPlayerName('')).toBe(false);
    expect(isValidPlayerName('   ')).toBe(false);
    expect(isValidPlayerName('!!!')).toBe(false);
    expect(isValidPlayerName('💥')).toBe(false);
    expect(isValidPlayerName(undefined)).toBe(false);
  });
});
