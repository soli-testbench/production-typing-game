/**
 * Shared player-name sanitizer used by both the client
 * ({@link PlayerProvider}, {@link NameEntryModal}) and the server
 * (`POST /api/scores`).
 *
 * Keeping the implementation in one place guarantees that the client and
 * server apply the exact same rules, so a name the UI accepts cannot be
 * rejected by the API and vice versa.
 *
 * Order of operations (applied deterministically in this order):
 *
 *   1. `trim()`                 — drop leading/trailing whitespace so users
 *                                 pasting names with accidental spaces get
 *                                 them stripped before length is measured.
 *   2. strip invalid characters — only `[a-zA-Z0-9 ]` are retained; any
 *                                 other code point (emoji, punctuation,
 *                                 control chars, …) is removed.
 *   3. `slice(0, 20)`           — enforce the 20-character maximum.
 *   4. `trim()`                 — re-trim in case the slice left a
 *                                 trailing space (e.g. `"alice                "`).
 *
 * The final result is always a string of 0–20 characters containing only
 * letters, digits, and spaces, with no leading or trailing whitespace.
 *
 * An input that produces an empty string after sanitization is rejected
 * downstream (both the client modal and the `/api/scores` route surface a
 * "name is required" error). This function itself never throws.
 */
export const MAX_PLAYER_NAME_LENGTH = 20;

/** Characters allowed in a player name: letters, digits, and ASCII space. */
const INVALID_NAME_CHARS = /[^a-zA-Z0-9 ]/g;

export function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name
    .trim()
    .replace(INVALID_NAME_CHARS, '')
    .slice(0, MAX_PLAYER_NAME_LENGTH)
    .trim();
}

/**
 * Returns true iff {@link sanitizeName} would produce a non-empty string
 * for `name`. Useful for client-side validation (e.g. disabling a submit
 * button) where we want the same rules as the server but without
 * mutating the user's in-progress input.
 */
export function isValidPlayerName(name: unknown): boolean {
  return sanitizeName(name).length > 0;
}
