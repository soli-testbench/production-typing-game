'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '@/components/PlayerProvider';

interface LeaderboardEntry {
  id: number;
  username: string;
  wpm: number;
  raw_wpm: number;
  accuracy: string;
  duration_seconds: number;
  game_mode?: string;
  created_at: string;
  is_current_user: boolean;
}

interface CurrentPlayerRank {
  rank: number;
  wpm: number;
  accuracy: number;
  durationSeconds: number;
  gameMode: string;
}

const durations = [
  { label: 'All', value: '' },
  { label: '15s', value: '15' },
  { label: '30s', value: '30' },
  { label: '60s', value: '60' },
  { label: '120s', value: '120' },
  { label: '10w', value: 'words-10' },
  { label: '25w', value: 'words-25' },
  { label: '50w', value: 'words-50' },
  { label: '100w', value: 'words-100' },
];

/**
 * Derive the filter-tab label for a leaderboard row. Mirrors the `durations`
 * array above: word-count modes use the `NNw` convention, timed modes use
 * the `NNs` duration. Kept in one place so the badge rendered on the "All"
 * view always matches what the user clicked on to get there.
 */
function modeBadgeLabel(entry: { game_mode?: string; duration_seconds: number }): string {
  if (entry.game_mode && entry.game_mode.startsWith('words-')) {
    return `${entry.game_mode.replace('words-', '')}w`;
  }
  return `${entry.duration_seconds}s`;
}

/**
 * Color-code the badge so word modes and timed modes are visually distinct
 * at a glance, while still reading as muted accent tags that don't pull
 * focus from the primary WPM column.
 */
function modeBadgeClasses(entry: { game_mode?: string }): string {
  const isWordMode = !!entry.game_mode && entry.game_mode.startsWith('words-');
  return isWordMode
    ? 'bg-neon-blue/15 text-neon-blue border border-neon-blue/30'
    : 'bg-neon-purple/15 text-neon-purple border border-neon-purple/30';
}

export default function LeaderboardPage() {
  const { anonymousId } = usePlayer();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentPlayerRank, setCurrentPlayerRank] = useState<CurrentPlayerRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState('');
  const [error, setError] = useState('');

  const fetchLeaderboard = useCallback(async (duration: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (duration) params.set('duration', duration);
      const url = `/api/leaderboard${params.toString() ? `?${params.toString()}` : ''}`;
      const headers: Record<string, string> = {};
      if (anonymousId) headers['X-Anonymous-Id'] = anonymousId;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const data = await res.json();
      setEntries(data.leaderboard || []);
      setCurrentPlayerRank(data.currentPlayerRank ?? null);
    } catch {
      setError('Failed to load leaderboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [anonymousId]);

  useEffect(() => {
    fetchLeaderboard(selectedDuration);
  }, [selectedDuration, fetchLeaderboard]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-center mb-8">
        <span className="text-neon-purple">Leader</span>
        <span className="text-gray-300">board</span>
      </h1>

      {/* Duration Filter Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        {durations.map((d) => (
          <button
            key={d.value}
            onClick={() => setSelectedDuration(d.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedDuration === d.value
                ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30'
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-20">
          <div className="inline-block w-8 h-8 border-2 border-neon-purple/30 border-t-neon-purple rounded-full animate-spin" />
          <p className="text-gray-500 mt-4">Loading leaderboard...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-20">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => fetchLeaderboard(selectedDuration)}
            className="mt-4 px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">No scores yet</p>
          <p className="text-gray-600 text-sm mt-2">Be the first to set a record!</p>
        </div>
      )}

      {/* Leaderboard Table */}
      {!loading && !error && entries.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium">Rank</th>
                <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium">Player</th>
                <th className="text-right py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium">WPM</th>
                <th
                  className="text-right py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium hidden md:table-cell"
                  title="Raw WPM counts every keystroke, including errors. Net WPM (the primary WPM column) subtracts mistakes, so Raw WPM is always ≥ Net WPM."
                >
                  <span className="inline-flex items-center justify-end gap-1">
                    Raw WPM
                    <span
                      aria-hidden="true"
                      className="text-gray-600 text-[10px] border border-gray-700 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center leading-none cursor-help"
                    >
                      i
                    </span>
                  </span>
                </th>
                <th className="text-right py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium hidden sm:table-cell">Accuracy</th>
                <th className="text-right py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium hidden md:table-cell">Duration</th>
                <th className="text-right py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const isCurrentPlayer = entry.is_current_user;
                const rank = index + 1;
                const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

                return (
                  <tr
                    key={entry.id}
                    className={`border-b border-gray-800/50 transition-colors ${
                      isCurrentPlayer
                        ? 'bg-neon-blue/5 border-l-2 border-l-neon-blue'
                        : 'hover:bg-gray-900/30'
                    }`}
                  >
                    <td className="py-3 px-4">
                      <span className={`font-bold ${rank <= 3 ? 'text-neon-yellow' : 'text-gray-500'}`}>
                        {rankIcon || `#${rank}`}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={isCurrentPlayer ? 'text-neon-blue font-semibold' : 'text-gray-300'}>
                        {entry.username}
                      </span>
                      {isCurrentPlayer && (
                        <span className="ml-2 text-xs text-neon-blue/60">(you)</span>
                      )}
                      {/* Mode badge — only shown on the "All" view, where
                          rows mix different game modes. When a specific
                          filter is active every row has the same mode so
                          the badge would be redundant noise. */}
                      {selectedDuration === '' && (
                        <span
                          className={`ml-2 inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded align-middle ${modeBadgeClasses(entry)}`}
                          aria-label={`Game mode ${modeBadgeLabel(entry)}`}
                        >
                          {modeBadgeLabel(entry)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-neon-green font-bold">{entry.wpm}</span>
                    </td>
                    <td
                      className="py-3 px-4 text-right hidden md:table-cell"
                      title="Raw WPM counts every keystroke, including errors. Net WPM (the WPM column) subtracts mistakes."
                    >
                      <span className="text-gray-400 tabular-nums">{entry.raw_wpm}</span>
                    </td>
                    <td className="py-3 px-4 text-right hidden sm:table-cell">
                      <span className="text-gray-400">{Number(entry.accuracy).toFixed(0)}%</span>
                    </td>
                    <td className="py-3 px-4 text-right hidden md:table-cell">
                      <span className="text-gray-500">
                        {entry.game_mode?.startsWith('words-')
                          ? `${entry.game_mode.replace('words-', '')}w / ${entry.duration_seconds}s`
                          : `${entry.duration_seconds}s`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right hidden md:table-cell">
                      <span className="text-gray-600 text-sm">{formatDate(entry.created_at)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Player's own rank when outside the top 100. The API returns
              currentPlayerRank for the active filter so the player always
              has a sense of where they stand even if they aren't in the
              visible slice. If they *are* in the table, the existing
              "(you)" highlight is sufficient and we skip this banner. */}
          {currentPlayerRank && !entries.some((e) => e.is_current_user) && (
            <div className="mt-6 text-center">
              <div className="inline-block px-6 py-3 bg-neon-blue/10 border border-neon-blue/30 rounded-lg">
                <span className="text-gray-400 text-sm uppercase tracking-wider mr-2">
                  Your rank
                </span>
                <span className="text-neon-blue font-bold text-lg">
                  #{currentPlayerRank.rank}
                </span>
                <span className="text-gray-500 mx-2">—</span>
                <span className="text-neon-green font-bold text-lg">
                  {currentPlayerRank.wpm} WPM
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
