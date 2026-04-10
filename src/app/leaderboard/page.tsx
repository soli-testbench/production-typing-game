'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '@/components/PlayerProvider';

interface LeaderboardEntry {
  id: number;
  username: string;
  anonymous_id: string;
  wpm: number;
  raw_wpm: number;
  accuracy: string;
  duration_seconds: number;
  created_at: string;
}

const durations = [
  { label: 'All', value: '' },
  { label: '15s', value: '15' },
  { label: '30s', value: '30' },
  { label: '60s', value: '60' },
  { label: '120s', value: '120' },
];

export default function LeaderboardPage() {
  const { anonymousId } = usePlayer();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDuration, setSelectedDuration] = useState('');
  const [error, setError] = useState('');

  const fetchLeaderboard = useCallback(async (duration: string) => {
    setLoading(true);
    setError('');
    try {
      const url = duration
        ? `/api/leaderboard?duration=${duration}`
        : '/api/leaderboard';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const data = await res.json();
      setEntries(data.leaderboard || []);
    } catch {
      setError('Failed to load leaderboard. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

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
                <th className="text-right py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium hidden sm:table-cell">Accuracy</th>
                <th className="text-right py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium hidden md:table-cell">Duration</th>
                <th className="text-right py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => {
                const isCurrentPlayer = entry.anonymous_id === anonymousId;
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
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-neon-green font-bold">{entry.wpm}</span>
                    </td>
                    <td className="py-3 px-4 text-right hidden sm:table-cell">
                      <span className="text-gray-400">{Number(entry.accuracy).toFixed(0)}%</span>
                    </td>
                    <td className="py-3 px-4 text-right hidden md:table-cell">
                      <span className="text-gray-500">{entry.duration_seconds}s</span>
                    </td>
                    <td className="py-3 px-4 text-right hidden md:table-cell">
                      <span className="text-gray-600 text-sm">{formatDate(entry.created_at)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
