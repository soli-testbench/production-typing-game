import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

// Read migration SQL from the shared module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsFile = readFileSync(join(__dirname, 'migrations.ts'), 'utf-8');
const sqlMatch = migrationsFile.match(/`([\s\S]*?)`/);
const migrationSQL = sqlMatch ? sqlMatch[1] : '';

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  if (!migrationSQL) {
    console.error('Failed to read migration SQL from shared module');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 10000,
  });

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
