import { NextRequest, NextResponse } from 'next/server';
import { query, ensureMigrations } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 20).trim();
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || '127.0.0.1';
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

    // Validate duration
    if (![15, 30, 60, 120].includes(durationSeconds)) {
      return NextResponse.json({ error: 'Duration must be 15, 30, 60, or 120 seconds' }, { status: 400 });
    }

    // Validate character counts
    if (typeof correctChars !== 'number' || correctChars < 0) {
      return NextResponse.json({ error: 'correctChars must be a non-negative number' }, { status: 400 });
    }
    if (typeof incorrectChars !== 'number' || incorrectChars < 0) {
      return NextResponse.json({ error: 'incorrectChars must be a non-negative number' }, { status: 400 });
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
    }, { status: 201 });
  } catch (error) {
    console.error('Error saving score:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureMigrations();

    const { searchParams } = new URL(request.url);
    const anonymousId = searchParams.get('anonymousId');

    if (!anonymousId) {
      return NextResponse.json({ error: 'anonymousId query parameter is required' }, { status: 400 });
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
    console.error('Error fetching scores:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
