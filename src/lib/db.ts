import { Pool, PoolClient, QueryResult } from 'pg';
import { migrationSQL } from './migrations';

let pool: Pool | null = null;
let migrationsRun = false;

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Strip any connection string or credentials from the error message
  return message
    .replace(/postgresql?:\/\/[^\s]+/gi, '[REDACTED_URL]')
    .replace(/postgres:\/\/[^\s]+/gi, '[REDACTED_URL]')
    .replace(/password[=:]\s*\S+/gi, 'password=[REDACTED]')
    .replace(/host=[^\s;]+/gi, 'host=[REDACTED]');
}

function invalidatePool(): void {
  if (pool) {
    const oldPool = pool;
    pool = null;
    migrationsRun = false;
    // End the old pool in the background; ignore errors since it's already broken
    oldPool.end().catch((err) => {
      console.error('Error ending invalidated pool:', sanitizeErrorMessage(err));
    });
  }
}

function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  const connectionErrorCodes = [
    'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT',
    'CONNECTION_ENDED', 'CONNECTION_DESTROYED',
    '57P01', // admin_shutdown
    '57P02', // crash_shutdown
    '57P03', // cannot_connect_now
    '08000', // connection_exception
    '08003', // connection_does_not_exist
    '08006', // connection_failure
  ];
  if (code && connectionErrorCodes.includes(code)) return true;
  const msg = error.message.toLowerCase();
  return msg.includes('connection terminated') ||
    msg.includes('connection refused') ||
    msg.includes('connection reset') ||
    msg.includes('timeout') ||
    msg.includes('cannot connect');
}

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

    // Handle unexpected errors on idle clients to prevent process crash
    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', sanitizeErrorMessage(err));
      invalidatePool();
    });
  }
  return pool;
}

export async function query(text: string, params?: (string | number | boolean | null)[]): Promise<QueryResult> {
  let client: PoolClient | null = null;
  try {
    client = await getPool().connect();
    return await client.query(text, params);
  } catch (error) {
    if (isConnectionError(error)) {
      console.error('Database connection error, invalidating pool:', sanitizeErrorMessage(error));
      invalidatePool();
    }
    throw error;
  } finally {
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error('Error releasing database client:', sanitizeErrorMessage(releaseError));
      }
    }
  }
}

export async function ensureMigrations(): Promise<void> {
  if (!migrationsRun) {
    await query(migrationSQL);
    migrationsRun = true;
  }
}

export { sanitizeErrorMessage, isConnectionError };
