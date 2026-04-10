import { NextRequest, NextResponse } from 'next/server';
import { query, ensureMigrations, isConnectionError, sanitizeErrorMessage } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || '127.0.0.1';
}

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateCheck = checkRateLimit(ip, 30);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
      );
    }

    await ensureMigrations();

    const { searchParams } = new URL(request.url);
    const durationParam = searchParams.get('duration');
    const anonymousId = request.headers.get('x-anonymous-id');

    // Look up the current player's id server-side so anonymous_id is never selected in the leaderboard query
    let currentPlayerId: number | null = null;
    if (anonymousId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(anonymousId)) {
        const playerResult = await query('SELECT id FROM players WHERE anonymous_id = $1', [anonymousId]);
        if (playerResult.rows.length > 0) {
          currentPlayerId = playerResult.rows[0].id;
        }
      }
    }

    let sql: string;
    let params: (string | number)[];

    // Support filtering by duration (timed modes) or game_mode (word modes)
    const validWordModes = ['words-10', 'words-25', 'words-50', 'words-100'];
    const isWordModeFilter = durationParam && validWordModes.includes(durationParam);

    if (isWordModeFilter) {
      sql = `
        SELECT sub.id, sub.player_id, sub.username, sub.wpm, sub.raw_wpm, sub.accuracy,
               sub.duration_seconds, sub.correct_chars, sub.incorrect_chars, sub.created_at,
               sub.game_mode
        FROM (
          SELECT DISTINCT ON (p.id)
                 gr.id, p.id AS player_id, p.username, gr.wpm, gr.raw_wpm, gr.accuracy,
                 gr.duration_seconds, gr.correct_chars, gr.incorrect_chars, gr.created_at,
                 gr.game_mode
          FROM game_results gr
          JOIN players p ON gr.player_id = p.id
          WHERE gr.game_mode = $1
          ORDER BY p.id, gr.wpm DESC, gr.accuracy DESC
        ) sub
        ORDER BY sub.wpm DESC, sub.accuracy DESC
        LIMIT 100
      `;
      params = [durationParam];
    } else if (durationParam && [15, 30, 60, 120].includes(Number(durationParam))) {
      sql = `
        SELECT sub.id, sub.player_id, sub.username, sub.wpm, sub.raw_wpm, sub.accuracy,
               sub.duration_seconds, sub.correct_chars, sub.incorrect_chars, sub.created_at,
               sub.game_mode
        FROM (
          SELECT DISTINCT ON (p.id)
                 gr.id, p.id AS player_id, p.username, gr.wpm, gr.raw_wpm, gr.accuracy,
                 gr.duration_seconds, gr.correct_chars, gr.incorrect_chars, gr.created_at,
                 gr.game_mode
          FROM game_results gr
          JOIN players p ON gr.player_id = p.id
          WHERE gr.duration_seconds = $1
          ORDER BY p.id, gr.wpm DESC, gr.accuracy DESC
        ) sub
        ORDER BY sub.wpm DESC, sub.accuracy DESC
        LIMIT 100
      `;
      params = [Number(durationParam)];
    } else {
      sql = `
        SELECT sub.id, sub.player_id, sub.username, sub.wpm, sub.raw_wpm, sub.accuracy,
               sub.duration_seconds, sub.correct_chars, sub.incorrect_chars, sub.created_at,
               sub.game_mode
        FROM (
          SELECT DISTINCT ON (p.id)
                 gr.id, p.id AS player_id, p.username, gr.wpm, gr.raw_wpm, gr.accuracy,
                 gr.duration_seconds, gr.correct_chars, gr.incorrect_chars, gr.created_at,
                 gr.game_mode
          FROM game_results gr
          JOIN players p ON gr.player_id = p.id
          ORDER BY p.id, gr.wpm DESC, gr.accuracy DESC
        ) sub
        ORDER BY sub.wpm DESC, sub.accuracy DESC
        LIMIT 100
      `;
      params = [];
    }

    const result = await query(sql, params);

    const leaderboard = result.rows
      .map((row: { player_id: number; [key: string]: string | number }) => {
        const isCurrentUser = currentPlayerId !== null && row.player_id === currentPlayerId;
        const { player_id: _removed, ...rest } = row;
        return { ...rest, is_current_user: isCurrentUser };
      });

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', sanitizeErrorMessage(error));
    if (isConnectionError(error)) {
      return NextResponse.json({ error: 'Database is temporarily unavailable. Please try again later.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
