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

    let sql: string;
    let params: (string | number)[];

    if (durationParam && [15, 30, 60, 120].includes(Number(durationParam))) {
      sql = `
        SELECT gr.id, p.username, p.anonymous_id, gr.wpm, gr.raw_wpm, gr.accuracy,
               gr.duration_seconds, gr.correct_chars, gr.incorrect_chars, gr.created_at
        FROM game_results gr
        JOIN players p ON gr.player_id = p.id
        WHERE gr.duration_seconds = $1
        ORDER BY gr.wpm DESC, gr.accuracy DESC
        LIMIT 100
      `;
      params = [Number(durationParam)];
    } else {
      sql = `
        SELECT gr.id, p.username, p.anonymous_id, gr.wpm, gr.raw_wpm, gr.accuracy,
               gr.duration_seconds, gr.correct_chars, gr.incorrect_chars, gr.created_at
        FROM game_results gr
        JOIN players p ON gr.player_id = p.id
        ORDER BY gr.wpm DESC, gr.accuracy DESC
        LIMIT 100
      `;
      params = [];
    }

    const result = await query(sql, params);

    return NextResponse.json({ leaderboard: result.rows });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
