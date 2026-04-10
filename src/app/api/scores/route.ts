import { NextRequest, NextResponse } from 'next/server';
import { query, ensureMigrations, isConnectionError, sanitizeErrorMessage } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkDurationRateLimit } from '@/lib/duration-rate-limit';
import { getClientIp } from '@/lib/request-utils';

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 20).trim();
}

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

    // Validate WPM (0-300)
    if (typeof wpm !== 'number' || wpm < 0 || wpm > 300) {
      return NextResponse.json({ error: 'WPM must be a number between 0 and 300' }, { status: 400 });
    }

    // Validate raw WPM (0-300)
    if (typeof rawWpm !== 'number' || rawWpm < 0 || rawWpm > 300) {
      return NextResponse.json({ error: 'Raw WPM must be a number between 0 and 300' }, { status: 400 });
    }

    // Validate accuracy (0-100)
    if (typeof accuracy !== 'number' || accuracy < 0 || accuracy > 100) {
      return NextResponse.json({ error: 'Accuracy must be a number between 0 and 100' }, { status: 400 });
    }

    // Validate game mode and duration
    const validWordModes = ['words-10', 'words-25', 'words-50', 'words-100'];
    const isWordMode = validWordModes.includes(gameMode);
    if (!isWordMode && ![15, 30, 60, 120].includes(durationSeconds)) {
      return NextResponse.json({ error: 'Duration must be 15, 30, 60, or 120 seconds for timed mode' }, { status: 400 });
    }
    if (isWordMode && (typeof durationSeconds !== 'number' || durationSeconds < 1 || durationSeconds > 3600)) {
      return NextResponse.json({ error: 'Duration must be between 1 and 3600 seconds for word mode' }, { status: 400 });
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

    // Cross-validate WPM against character counts and duration
    // Skip validation for very short durations (under 3 seconds) where rounding causes large deviations
    if (correctChars > 0 && durationSeconds >= 3) {
      const expectedWpm = (correctChars / 5) / (durationSeconds / 60);
      const wpmDeviation = Math.abs(wpm - expectedWpm) / expectedWpm;
      if (wpmDeviation > 0.15) {
        return NextResponse.json(
          { error: `Invalid submission: WPM (${wpm}) does not match expected value based on correct characters (${correctChars}) and duration (${durationSeconds}s). Expected approximately ${Math.round(expectedWpm)} WPM (±15% tolerance).` },
          { status: 400 }
        );
      }
    }

    // Cross-validate accuracy against character counts
    const totalChars = correctChars + incorrectChars;
    if (totalChars > 0) {
      const expectedAccuracy = (correctChars / totalChars) * 100;
      const accuracyDeviation = Math.abs(accuracy - expectedAccuracy);
      if (accuracyDeviation > 3) {
        return NextResponse.json(
          { error: `Invalid submission: accuracy (${accuracy}%) does not match expected value based on character counts. Expected approximately ${Math.round(expectedAccuracy)}% (±3% tolerance).` },
          { status: 400 }
        );
      }
    }

    // Duration-aware rate limiting: prevent submitting faster than test duration allows
    if (!isWordMode) {
      const durationRateCheck = checkDurationRateLimit(ip, durationSeconds);
      if (!durationRateCheck.allowed) {
        return NextResponse.json(
          { error: `Submission too frequent for a ${durationSeconds}s test. Try again in ${durationRateCheck.retryAfter} seconds.` },
          { status: 429, headers: { 'Retry-After': String(durationRateCheck.retryAfter) } }
        );
      }
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

    // Fetch previous best WPM for this duration and game mode before inserting the new score
    const effectiveGameMode = gameMode || 'classic';
    const previousBestResult = await query(
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

    const result = await query(
      `SELECT gr.id, gr.game_mode, gr.wpm, gr.raw_wpm, gr.accuracy, gr.duration_seconds,
              gr.correct_chars, gr.incorrect_chars, gr.created_at, p.username
       FROM game_results gr
       JOIN players p ON gr.player_id = p.id
       WHERE p.anonymous_id = $1
       ORDER BY gr.created_at DESC
       LIMIT 100`,
      [anonymousId]
    );

    return NextResponse.json({ scores: result.rows });
  } catch (error) {
    console.error('Error fetching scores:', sanitizeErrorMessage(error));
    if (isConnectionError(error)) {
      return NextResponse.json({ error: 'Database is temporarily unavailable. Please try again later.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
