import { NextRequest, NextResponse } from 'next/server';
import { query, runMigrations } from '@/lib/db';

let migrationsRun = false;

async function ensureMigrations() {
  if (!migrationsRun) {
    await runMigrations();
    migrationsRun = true;
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureMigrations();

    const { searchParams } = new URL(request.url);
    const durationParam = searchParams.get('duration');
    const anonymousId = searchParams.get('anonymousId');

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

    if (durationParam && [15, 30, 60, 120].includes(Number(durationParam))) {
      sql = `
        SELECT DISTINCT ON (p.id)
               gr.id, p.id AS player_id, p.username, gr.wpm, gr.raw_wpm, gr.accuracy,
               gr.duration_seconds, gr.correct_chars, gr.incorrect_chars, gr.created_at
        FROM game_results gr
        JOIN players p ON gr.player_id = p.id
        WHERE gr.duration_seconds = $1
        ORDER BY p.id, gr.wpm DESC, gr.accuracy DESC
      `;
      params = [Number(durationParam)];
    } else {
      sql = `
        SELECT DISTINCT ON (p.id)
               gr.id, p.id AS player_id, p.username, gr.wpm, gr.raw_wpm, gr.accuracy,
               gr.duration_seconds, gr.correct_chars, gr.incorrect_chars, gr.created_at
        FROM game_results gr
        JOIN players p ON gr.player_id = p.id
        ORDER BY p.id, gr.wpm DESC, gr.accuracy DESC
      `;
      params = [];
    }

    const result = await query(sql, params);

    // Sort by WPM descending, limit to 100, and add is_current_user flag
    const leaderboard = result.rows
      .sort((a: { wpm: number; accuracy: string }, b: { wpm: number; accuracy: string }) =>
        b.wpm - a.wpm || Number(b.accuracy) - Number(a.accuracy)
      )
      .slice(0, 100)
      .map((row: { player_id: number; [key: string]: string | number }) => {
        const isCurrentUser = currentPlayerId !== null && row.player_id === currentPlayerId;
        const { player_id: _removed, ...rest } = row;
        return { ...rest, is_current_user: isCurrentUser };
      });

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
