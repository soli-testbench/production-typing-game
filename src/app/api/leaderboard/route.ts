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

    let sql: string;
    let params: (string | number)[];

    if (durationParam && [15, 30, 60, 120].includes(Number(durationParam))) {
      sql = `
        SELECT DISTINCT ON (p.id)
               gr.id, p.username, p.anonymous_id, gr.wpm, gr.raw_wpm, gr.accuracy,
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
               gr.id, p.username, p.anonymous_id, gr.wpm, gr.raw_wpm, gr.accuracy,
               gr.duration_seconds, gr.correct_chars, gr.incorrect_chars, gr.created_at
        FROM game_results gr
        JOIN players p ON gr.player_id = p.id
        ORDER BY p.id, gr.wpm DESC, gr.accuracy DESC
      `;
      params = [];
    }

    const result = await query(sql, params);

    // Sort by WPM descending, limit to 100, add is_current_user flag, and remove anonymous_id
    const leaderboard = result.rows
      .sort((a: { wpm: number; accuracy: string }, b: { wpm: number; accuracy: string }) =>
        b.wpm - a.wpm || Number(b.accuracy) - Number(a.accuracy)
      )
      .slice(0, 100)
      .map((row: { anonymous_id: string; [key: string]: string | number }) => {
        const isCurrentUser = anonymousId ? row.anonymous_id === anonymousId : false;
        const { anonymous_id: _removed, ...rest } = row;
        return { ...rest, is_current_user: isCurrentUser };
      });

    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
