import pg from 'pg';

const { Pool } = pg;

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 10000,
  });

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

  try {
    await pool.query(migrationSQL);
    console.log('Migrations completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
