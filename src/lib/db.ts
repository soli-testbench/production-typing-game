import { Pool, QueryResult } from 'pg';
import { migrationSQL } from './migrations';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true },
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

let migrationsRun = false;

export async function ensureMigrations(): Promise<void> {
  if (!migrationsRun) {
    await query(migrationSQL);
    migrationsRun = true;
  }
}
