/**
 * Shared pure functions for Words-Per-Minute (WPM) and accuracy calculations.
 *
 * These helpers centralize the formulas used by the live typing UI, the
 * end-of-game results screen and the server-side cross-validation in
 * `/api/scores`. Keeping them in one place guarantees that the client's
 * reported numbers and the server's sanity checks always use the exact
 * same math — any change to the formula only needs to happen here.
 *
 * All functions are pure (no side effects, deterministic) and safe to call
 * with zero / very small inputs; they will return sensible defaults rather
 * than `NaN` or `Infinity`.
 */

/**
 * Minimum elapsed time (in seconds) used as the denominator when computing
 * WPM. This prevents divide-by-zero and wildly inflated WPM numbers during
 * the first fraction of a second of a game.
 */
const MIN_ELAPSED_SECONDS = 1;

/**
 * Calculate net Words-Per-Minute (WPM) from the number of *correctly* typed
 * characters and the elapsed time in seconds.
 *
 * Formula: `WPM = (correctChars / 5) / (elapsedSeconds / 60)`
 *
 * The division by 5 follows the industry-standard convention that one
 * "word" equals 5 characters, including spaces. The result is rounded to
 * the nearest integer.
 *
 * @param correctChars   Number of characters that matched the expected text.
 * @param elapsedSeconds Elapsed test time in seconds. Values below 1 are
 *                       clamped to 1 second to avoid divide-by-zero.
 * @returns Rounded, non-negative WPM. Returns 0 when inputs are invalid.
 */
export function calculateWpm(correctChars: number, elapsedSeconds: number): number {
  if (!Number.isFinite(correctChars) || correctChars <= 0) return 0;
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0;
  const elapsedMinutes = Math.max(elapsedSeconds, MIN_ELAPSED_SECONDS) / 60;
  return Math.round(correctChars / 5 / elapsedMinutes);
}

/**
 * Calculate raw (gross) Words-Per-Minute using *all* typed characters,
 * correct or not.
 *
 * Formula: `rawWPM = (totalChars / 5) / (elapsedSeconds / 60)`
 *
 * Raw WPM ignores mistakes and therefore upper-bounds {@link calculateWpm}.
 *
 * @param totalChars     Total characters typed (correct + incorrect).
 * @param elapsedSeconds Elapsed test time in seconds. Values below 1 are
 *                       clamped to 1 second to avoid divide-by-zero.
 * @returns Rounded, non-negative raw WPM. Returns 0 when inputs are invalid.
 */
export function calculateRawWpm(totalChars: number, elapsedSeconds: number): number {
  if (!Number.isFinite(totalChars) || totalChars <= 0) return 0;
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return 0;
  const elapsedMinutes = Math.max(elapsedSeconds, MIN_ELAPSED_SECONDS) / 60;
  return Math.round(totalChars / 5 / elapsedMinutes);
}

/**
 * Calculate typing accuracy as a whole-number percentage.
 *
 * Formula: `accuracy = round((correct / total) * 100)`
 *
 * Returns 100 when the user has not typed anything yet — by convention the
 * game displays a fresh session as "100% accuracy" before any input.
 *
 * @param correct Number of correctly typed characters.
 * @param total   Total characters typed (correct + incorrect).
 * @returns Integer percentage in the range `[0, 100]`.
 */
export function calculateAccuracy(correct: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 100;
  if (!Number.isFinite(correct) || correct < 0) return 0;
  const pct = (correct / total) * 100;
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return Math.round(pct);
}
