import { NextRequest, NextResponse } from 'next/server';
import { query, ensureMigrations, isConnectionError, sanitizeErrorMessage } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkDurationRateLimit } from '@/lib/duration-rate-limit';
import { getClientIp } from '@/lib/request-utils';
import { calculateWpm, calculateAccuracy } from '@/lib/typing-utils';
import { sanitizeName } from '@/lib/sanitize-name';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
      );
    }

    const body = await request.json();
    const { playerName, anonymousId, gameMode, wpm, rawWpm, accuracy, durationSeconds, correctChars, incorrectChars } = body;

    // Validate required fields
    if (!playerName || !anonymousId) {
      return NextResponse.json({ error: 'playerName and anonymousId are required' }, { status: 400 });
    }

    // Validate playerName
    const sanitizedName = sanitizeName(playerName);
    if (!sanitizedName) {
      return NextResponse.json({ error: 'Player name must contain alphanumeric characters (max 20 chars)' }, { status: 400 });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(anonymousId)) {
      return NextResponse.json({ error: 'Invalid anonymousId format' }, { status: 400 });
    }

    // Determine game mode early for use in validation
    const validWordModes = ['words-10', 'words-25', 'words-50', 'words-100'];
    const isWordMode = validWordModes.includes(gameMode);
    const wordCount = isWordMode ? parseInt((gameMode as string).replace('words-', ''), 10) : null;

    // Validate WPM (0-300 for time mode, 0-500 for word mode to handle burst typing on short tests)
    const wpmCap = isWordMode ? 500 : 300;
    if (typeof wpm !== 'number' || wpm < 0 || wpm > wpmCap) {
      return NextResponse.json({ error: `WPM must be a number between 0 and ${wpmCap}` }, { status: 400 });
    }

    // Validate raw WPM (0-300 for time mode, 0-500 for word mode)
    if (typeof rawWpm !== 'number' || rawWpm < 0 || rawWpm > wpmCap) {
      return NextResponse.json({ error: `Raw WPM must be a number between 0 and ${wpmCap}` }, { status: 400 });
    }

    // Validate accuracy (0-100)
    if (typeof accuracy !== 'number' || accuracy < 0 || accuracy > 100) {
      return NextResponse.json({ error: 'Accuracy must be a number between 0 and 100' }, { status: 400 });
    }

    // Validate game mode and duration
    if (!isWordMode && ![15, 30, 60, 120].includes(durationSeconds)) {
      return NextResponse.json({ error: 'Duration must be 15, 30, 60, or 120 seconds for timed mode' }, { status: 400 });
    }
    if (isWordMode && (typeof durationSeconds !== 'number' || durationSeconds < 0.1 || durationSeconds > 3600)) {
      return NextResponse.json({ error: 'Duration must be between 0.1 and 3600 seconds for word mode' }, { status: 400 });
    }

    // Minimum completion time sanity check for word mode: reject impossibly fast submissions.
    // Floor is wordCount / 4 seconds (equivalent to ~300 WPM, faster than any legitimate typist sustains).
    if (isWordMode && wordCount !== null) {
      const minCompletionTime = wordCount / 4;
      if (durationSeconds < minCompletionTime) {
        return NextResponse.json(
          { error: `Invalid submission: completion time (${durationSeconds}s) is impossibly fast for ${wordCount} words (minimum ${minCompletionTime}s).` },
          { status: 400 }
        );
      }
    }

    // Validate character counts
    if (typeof correctChars !== 'number' || correctChars < 0) {
      return NextResponse.json({ error: 'correctChars must be a non-negative number' }, { status: 400 });
    }
    if (typeof incorrectChars !== 'number' || incorrectChars < 0) {
      return NextResponse.json({ error: 'incorrectChars must be a non-negative number' }, { status: 400 });
    }

    // Cross-validate: zero correct chars but non-zero WPM is impossible
    if (correctChars === 0 && wpm > 0) {
      return NextResponse.json(
        { error: 'Invalid submission: WPM must be 0 when correctChars is 0' },
        { status: 400 }
      );
    }

    // Cross-validate: zero correct chars but 100% accuracy is impossible (unless no chars typed at all)
    if (correctChars === 0 && incorrectChars > 0 && accuracy > 0) {
      return NextResponse.json(
        { error: 'Invalid submission: accuracy must be 0 when there are no correct characters but there are incorrect characters' },
        { status: 400 }
      );
    }

    // Cross-validate WPM against character counts and duration using the
    // shared client/server formula. Skip validation for very short durations
    // (under 3 seconds) where integer rounding of the reported WPM produces
    // proportionally large deviations.
    if (correctChars > 0 && durationSeconds >= 3) {
      const expectedWpm = calculateWpm(correctChars, durationSeconds);
      const wpmDeviation = expectedWpm > 0 ? Math.abs(wpm - expectedWpm) / expectedWpm : 0;
      // Sliding tolerance: short tests have more rounding error
      const tolerance = durationSeconds < 20 ? 0.25 : durationSeconds <= 45 ? 0.20 : 0.15;
      const tolerancePercent = Math.round(tolerance * 100);
      if (wpmDeviation > tolerance) {
        return NextResponse.json(
          { error: `Invalid submission: WPM (${wpm}) does not match expected value based on correct characters (${correctChars}) and duration (${durationSeconds}s). Expected approximately ${expectedWpm} WPM (±${tolerancePercent}% tolerance).` },
          { status: 400 }
        );
      }
    }

    // Cross-validate accuracy against character counts using the shared formula.
    const totalChars = correctChars + incorrectChars;
    if (totalChars > 0) {
      const expectedAccuracy = calculateAccuracy(correctChars, totalChars);
      const accuracyDeviation = Math.abs(accuracy - expectedAccuracy);
      if (accuracyDeviation > 3) {
        return NextResponse.json(
          { error: `Invalid submission: accuracy (${accuracy}%) does not match expected value based on character counts. Expected approximately ${expectedAccuracy}% (±3% tolerance).` },
          { status: 400 }
        );
      }
    }

    // Duration-aware rate limiting: prevent submitting faster than test duration allows.
    // For word mode, segment the rate limit bucket by word count (not fractional duration)
    // so users can't bypass it by varying their reported completion time slightly.
    const rateLimitKey = isWordMode ? `words-${wordCount}` : undefined;
    const durationRateCheck = checkDurationRateLimit(ip, durationSeconds, rateLimitKey);
    if (!durationRateCheck.allowed) {
      const testLabel = isWordMode ? `${wordCount}-word` : `${durationSeconds}s`;
      return NextResponse.json(
        { error: `Submission too frequent for a ${testLabel} test. Try again in ${durationRateCheck.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(durationRateCheck.retryAfter) } }
      );
    }

    await ensureMigrations();

    // Create or retrieve player
    const playerResult = await query(
      `INSERT INTO players (username, anonymous_id)
       VALUES ($1, $2)
       ON CONFLICT (anonymous_id) DO UPDATE SET username = $1
       RETURNING id`,
      [sanitizedName, anonymousId]
    );
    const playerId = playerResult.rows[0].id;

    // Fetch previous best WPM before inserting the new score.
    // For word mode, compare against all scores with the same game_mode (e.g., 'words-25')
    // regardless of duration_seconds, since word mode completion times differ every run.
    // For timed mode, continue to match on duration_seconds so 15s/30s/60s/120s bests are separate.
    const effectiveGameMode = gameMode || 'classic';
    const previousBestResult = isWordMode
      ? await query(
          `SELECT MAX(gr.wpm) as best_wpm
           FROM game_results gr
           WHERE gr.player_id = $1 AND gr.game_mode = $2`,
          [playerId, effectiveGameMode]
        )
      : await query(
          `SELECT MAX(gr.wpm) as best_wpm
           FROM game_results gr
           WHERE gr.player_id = $1 AND gr.duration_seconds = $2 AND gr.game_mode = $3`,
          [playerId, durationSeconds, effectiveGameMode]
        );
    const previousBestWpm: number | null = previousBestResult.rows[0]?.best_wpm ?? null;

    // Insert game result
    const gameResult = await query(
      `INSERT INTO game_results (player_id, game_mode, wpm, raw_wpm, accuracy, duration_seconds, correct_chars, incorrect_chars)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [playerId, gameMode || 'classic', wpm, rawWpm, accuracy, durationSeconds, correctChars, incorrectChars]
    );

    return NextResponse.json({
      success: true,
      id: gameResult.rows[0].id,
      personalBest: {
        previousBestWpm,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error saving score:', sanitizeErrorMessage(error));
    if (isConnectionError(error)) {
      return NextResponse.json({ error: 'Database is temporarily unavailable. Please try again later.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Rate limit deletes strictly: max 1 per minute per IP so an attacker
    // cannot rapidly churn through player records. Reuses the existing
    // token-bucket by scoping under a tight maxRequests of 1.
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(ip, 1);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
      );
    }

    const anonymousId = request.headers.get('x-anonymous-id');
    if (!anonymousId) {
      return NextResponse.json({ error: 'X-Anonymous-Id header is required' }, { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(anonymousId)) {
      return NextResponse.json({ error: 'Invalid anonymousId format' }, { status: 400 });
    }

    await ensureMigrations();

    // Resolve player_id first — returning 404 when no record exists
    // matches the acceptance criterion and avoids deleting nothing
    // silently.
    const playerLookup = await query(
      'SELECT id FROM players WHERE anonymous_id = $1',
      [anonymousId]
    );
    if (playerLookup.rows.length === 0) {
      return NextResponse.json({ error: 'No player found for the given anonymousId' }, { status: 404 });
    }
    const playerId: number = playerLookup.rows[0].id;

    // Delete game_results first due to FK constraint on players(id).
    const gameDelete = await query(
      'DELETE FROM game_results WHERE player_id = $1',
      [playerId]
    );
    await query('DELETE FROM players WHERE id = $1', [playerId]);

    return NextResponse.json({
      success: true,
      deletedScores: gameDelete.rowCount ?? 0,
    });
  } catch (error) {
    console.error('Error deleting player data:', sanitizeErrorMessage(error));
    if (isConnectionError(error)) {
      return NextResponse.json({ error: 'Database is temporarily unavailable. Please try again later.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const readRateCheck = checkRateLimit(ip, 30);
    if (!readRateCheck.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${readRateCheck.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(readRateCheck.retryAfter) } }
      );
    }

    await ensureMigrations();

    const anonymousId = request.headers.get('x-anonymous-id');

    if (!anonymousId) {
      return NextResponse.json({ error: 'X-Anonymous-Id header is required' }, { status: 400 });
    }

    // Pagination query params. We clamp defensively to guard against
    // negative or excessively large values that would otherwise stress
    // the database with an unbounded LIMIT.
    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get('limit');
    const rawOffset = searchParams.get('offset');
    const parsedLimit = rawLimit === null ? 50 : parseInt(rawLimit, 10);
    const parsedOffset = rawOffset === null ? 0 : parseInt(rawOffset, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;
    const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    const [pageResult, summaryResult] = await Promise.all([
      query(
        `SELECT gr.id, gr.game_mode, gr.wpm, gr.raw_wpm, gr.accuracy, gr.duration_seconds,
                gr.correct_chars, gr.incorrect_chars, gr.created_at, p.username
         FROM game_results gr
         JOIN players p ON gr.player_id = p.id
         WHERE p.anonymous_id = $1
         ORDER BY gr.created_at DESC
         LIMIT $2 OFFSET $3`,
        [anonymousId, limit, offset]
      ),
      query(
        `SELECT
           COUNT(*)::int AS total_games,
           COALESCE(AVG(gr.wpm), 0)::float AS average_wpm,
           COALESCE(AVG(gr.accuracy), 0)::float AS average_accuracy,
           COALESCE(SUM(gr.duration_seconds), 0)::float AS total_time_seconds,
           COALESCE(SUM(gr.correct_chars + gr.incorrect_chars), 0)::int AS total_characters,
           COALESCE(MAX(gr.wpm), 0)::int AS best_wpm,
           COALESCE(MAX(gr.accuracy), 0)::float AS best_accuracy
         FROM game_results gr
         JOIN players p ON gr.player_id = p.id
         WHERE p.anonymous_id = $1`,
        [anonymousId]
      ),
    ]);

    const s = summaryResult.rows[0] || {};
    const totalGames: number = Number(s.total_games ?? 0);
    const summary = {
      totalGames,
      averageWpm: totalGames > 0 ? Math.round(Number(s.average_wpm)) : 0,
      averageAccuracy: totalGames > 0 ? Number(Number(s.average_accuracy).toFixed(1)) : 0,
      totalTimeSeconds: Number(Number(s.total_time_seconds ?? 0).toFixed(1)),
      totalCharacters: Number(s.total_characters ?? 0),
      bestWpm: Number(s.best_wpm ?? 0),
      bestAccuracy: totalGames > 0 ? Number(Number(s.best_accuracy).toFixed(1)) : 0,
    };

    return NextResponse.json({
      scores: pageResult.rows,
      total: totalGames,
      offset,
      limit,
      summary,
    });
  } catch (error) {
    console.error('Error fetching scores:', sanitizeErrorMessage(error));
    if (isConnectionError(error)) {
      return NextResponse.json({ error: 'Database is temporarily unavailable. Please try again later.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
