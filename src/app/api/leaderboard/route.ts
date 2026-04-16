import { NextRequest, NextResponse } from 'next/server';
import { query, ensureMigrations, isConnectionError, sanitizeErrorMessage } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/request-utils';

// In-memory cache for leaderboard query results.
// Keyed by the filter parameter (duration or word-mode string), TTL-based.
// We cache the raw rows (including player_id) so we can compute per-request
// is_current_user highlighting after cache retrieval.
interface CachedLeaderboardRow {
  id: number;
  player_id: number;
  username: string;
  wpm: number;
  raw_wpm: number;
  accuracy: number;
  duration_seconds: number;
  correct_chars: number;
  incorrect_chars: number;
  created_at: string;
  game_mode: string;
}

interface CacheEntry {
  rows: CachedLeaderboardRow[];
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const CACHE_MAX_AGE_SECONDS = 15;
const CACHE_SWR_SECONDS = 30;

const leaderboardCache = new Map<string, CacheEntry>();

function getCachedRows(key: string): CachedLeaderboardRow[] | null {
  const entry = leaderboardCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    leaderboardCache.delete(key);
    return null;
  }
  return entry.rows;
}

function setCachedRows(key: string, rows: CachedLeaderboardRow[]): void {
  leaderboardCache.set(key, { rows, expiresAt: Date.now() + CACHE_TTL_MS });
  // Opportunistic cleanup to prevent unbounded growth.
  if (leaderboardCache.size > 32) {
    const now = Date.now();
    leaderboardCache.forEach((v, k) => {
      if (v.expiresAt <= now) leaderboardCache.delete(k);
    });
  }
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

    // Build a cache key from the filter parameter. 'all' is the catch-all for
    // requests that don't match any recognized filter (falls through to the
    // unfiltered query). is_current_user is NOT part of the key \u2014 it's computed
    // per-request after cache retrieval.
    let cacheKey: string;
    if (isWordModeFilter) {
      cacheKey = `mode:${durationParam}`;
    } else if (durationParam && [15, 30, 60, 120].includes(Number(durationParam))) {
      cacheKey = `duration:${Number(durationParam)}`;
    } else {
      cacheKey = 'all';
    }

    const cacheHeaders = {
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${CACHE_SWR_SECONDS}`,
    };

    const cached = getCachedRows(cacheKey);
    if (cached) {
      const leaderboard = cached.map((row) => {
        const isCurrentUser = currentPlayerId !== null && row.player_id === currentPlayerId;
        const { player_id: _removed, ...rest } = row;
        return { ...rest, is_current_user: isCurrentUser };
      });
      return NextResponse.json({ leaderboard }, { headers: cacheHeaders });
    }

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
          WHERE gr.duration_seconds = $1 AND gr.game_mode = 'classic'
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
    const rows = result.rows as CachedLeaderboardRow[];

    // Populate the cache with the raw rows so subsequent requests within the
    // TTL window can skip the database entirely while still computing the
    // per-user is_current_user flag correctly.
    setCachedRows(cacheKey, rows);

    const leaderboard = rows.map((row) => {
      const isCurrentUser = currentPlayerId !== null && row.player_id === currentPlayerId;
      const { player_id: _removed, ...rest } = row;
      return { ...rest, is_current_user: isCurrentUser };
    });

    return NextResponse.json({ leaderboard }, { headers: cacheHeaders });
  } catch (error) {
    console.error('Error fetching leaderboard:', sanitizeErrorMessage(error));
    if (isConnectionError(error)) {
      return NextResponse.json({ error: 'Database is temporarily unavailable. Please try again later.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
