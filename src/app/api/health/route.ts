import { NextResponse } from 'next/server';
import { query, isConnectionError, sanitizeErrorMessage } from '@/lib/db';

// Mark the route dynamic so Next.js doesn't try to evaluate it at build
// time (which would fail because no DATABASE_URL is available during the
// build) and so each request hits the database live.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Overall timeout for the health check. The acceptance criteria require
// the endpoint to respond in under 2 seconds even when the database is
// unreachable; we use a slightly tighter 1.5s budget to leave headroom
// for the JSON response itself and any Next.js / Node overhead.
const HEALTH_TIMEOUT_MS = 1500;

interface HealthyResponse {
  status: 'ok';
  db: 'connected';
  dbLatencyMs: number;
}

interface DegradedResponse {
  status: 'degraded';
  db: 'disconnected';
  error?: string;
  dbLatencyMs?: number;
}

function timeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * GET /api/health
 *
 * Lightweight health / readiness endpoint suitable for use as a
 * deployment health-check target (e.g. a Fly.io `[[http_service.checks]]`
 * or a Kubernetes readiness probe). Performs a trivial `SELECT 1` against
 * the database and reports:
 *
 *   - 200 `{ status: 'ok', db: 'connected', dbLatencyMs: number }` when
 *     the app is responsive *and* the database accepts the query.
 *   - 503 `{ status: 'degraded', db: 'disconnected', error? }` when the
 *     database is unreachable, times out, or returns an error.
 *
 * Intentionally **not** rate-limited and **not** authenticated so that
 * load balancers and orchestrators can poll it on a short interval.
 */
export async function GET() {
  const start = Date.now();
  try {
    await timeout(query('SELECT 1'), HEALTH_TIMEOUT_MS, 'health check');
    const dbLatencyMs = Date.now() - start;
    const body: HealthyResponse = {
      status: 'ok',
      db: 'connected',
      dbLatencyMs,
    };
    return NextResponse.json(body, {
      status: 200,
      headers: {
        // Health checks should never be cached.
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    const dbLatencyMs = Date.now() - start;
    const sanitized = sanitizeErrorMessage(error);
    // Log connection errors at error level so they show up in container
    // logs, but avoid dumping the raw error (which may include the
    // connection string) back to the caller.
    if (isConnectionError(error)) {
      console.error('Health check: database unreachable', sanitized);
    } else {
      console.error('Health check: database query failed', sanitized);
    }
    const body: DegradedResponse = {
      status: 'degraded',
      db: 'disconnected',
      dbLatencyMs,
      error: sanitized,
    };
    return NextResponse.json(body, {
      status: 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  }
}
