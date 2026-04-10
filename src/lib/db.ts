import { Pool, QueryResult } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Neon Postgres serverless requires SSL but may have certificate chain issues
      // with rejectUnauthorized: true. Using rejectUnauthorized: false is Neon's
      // recommended configuration for serverless drivers. Connection is still encrypted.
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export async function query(text: string, params?: (string | number | boolean | null)[]): Promise<QueryResult> {
  const client = await getPool().connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  const migrationSQL = `
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      username VARCHAR(20) NOT NULL,
      anonymous_id UUID NOT NULL UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_players_anonymous_id ON players(anonymous_id);

    CREATE TABLE IF NOT EXISTS game_results (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      game_mode VARCHAR(20) NOT NULL DEFAULT 'classic',
      wpm INTEGER NOT NULL,
      raw_wpm INTEGER NOT NULL,
      accuracy NUMERIC(5,2) NOT NULL,
      duration_seconds INTEGER NOT NULL,
      correct_chars INTEGER NOT NULL DEFAULT 0,
      incorrect_chars INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_game_results_wpm ON game_results(wpm DESC);
    CREATE INDEX IF NOT EXISTS idx_game_results_duration ON game_results(duration_seconds);
    CREATE INDEX IF NOT EXISTS idx_game_results_player_id ON game_results(player_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_created_at ON game_results(created_at DESC);
  `;

  await query(migrationSQL);
}
