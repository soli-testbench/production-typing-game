'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '@/components/PlayerProvider';

interface ScoreEntry {
  id: number;
  game_mode: string;
  wpm: number;
  raw_wpm: number;
  accuracy: string;
  duration_seconds: number;
  correct_chars: number;
  incorrect_chars: number;
  created_at: string;
  username: string;
}

interface ScoresSummary {
  totalGames: number;
  averageWpm: number;
  averageAccuracy: number;
  totalTimeSeconds: number;
  totalCharacters: number;
  bestWpm: number;
  bestAccuracy: number;
}

const PAGE_SIZE = 50;

interface TrendMode {
  key: string;
  label: string;
}

function WpmTrendChart({ scores }: { scores: ScoreEntry[] }) {
  // This chart now plots WPM and accuracy together, with two Y-axes:
  //   - Left axis (neon-blue):   WPM   (0 .. max WPM)
  //   - Right axis (neon-yellow): Accuracy (0 .. 100)
  // Both lines follow the same X (game number in chronological order) so
  // the user can see how improvements in speed correlate with accuracy.

  // Determine available modes and their game counts
  const modeCounts: Record<string, number> = {};
  for (const s of scores) {
    const mode = s.game_mode && s.game_mode.startsWith('words-') ? s.game_mode : `${s.duration_seconds}s`;
    modeCounts[mode] = (modeCounts[mode] || 0) + 1;
  }

  const allModes: TrendMode[] = [
    { key: '15s', label: '15s' },
    { key: '30s', label: '30s' },
    { key: '60s', label: '60s' },
    { key: '120s', label: '120s' },
    { key: 'words-10', label: '10w' },
    { key: 'words-25', label: '25w' },
    { key: 'words-50', label: '50w' },
    { key: 'words-100', label: '100w' },
  ];

  const availableModes = allModes.filter((m) => (modeCounts[m.key] || 0) > 0);

  // Default to mode with most games
  const defaultMode = availableModes.length > 0
    ? availableModes.reduce((a, b) => (modeCounts[a.key] || 0) >= (modeCounts[b.key] || 0) ? a : b)
    : null;

  const [selectedMode, setSelectedMode] = useState<string>(defaultMode?.key || '');

  // Update default when scores change
  useEffect(() => {
    if (!selectedMode && defaultMode) {
      setSelectedMode(defaultMode.key);
    }
  }, [defaultMode, selectedMode]);

  // Filter scores by selected mode
  const filteredScores = scores.filter((s) => {
    if (!selectedMode) return false;
    if (selectedMode.startsWith('words-')) {
      return s.game_mode === selectedMode;
    }
    const dur = parseInt(selectedMode);
    return s.duration_seconds === dur && (!s.game_mode || s.game_mode === 'classic');
  });

  const chronological = [...filteredScores].reverse();
  const trendGames = chronological.slice(-20);
  const samples = trendGames.map((s) => s.wpm);
  const accuracySamples = trendGames.map((s) => Number(s.accuracy));

  const selectedLabel = allModes.find((m) => m.key === selectedMode)?.label || selectedMode;

  if (availableModes.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-8 text-center">
        <p className="text-gray-500 text-sm">Need at least 2 games for a trend chart</p>
      </div>
    );
  }

  if (samples.length < 2) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-8">
        <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
          {availableModes.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedMode(m.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedMode === m.key
                  ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-gray-500 text-sm text-center">Need at least 2 games in {selectedLabel} mode for a trend chart</p>
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 35, left: 45 };
  const viewBoxWidth = 600;
  const viewBoxHeight = 250;
  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const chartHeight = viewBoxHeight - padding.top - padding.bottom;

  const maxWpm = Math.max(...samples, 10);
  const minWpm = 0;
  const yRange = maxWpm - minWpm || 1;

  const xStep = chartWidth / (samples.length - 1);

  const points = samples.map((wpm, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartHeight - ((wpm - minWpm) / yRange) * chartHeight,
  }));

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const avgWpm = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  const avgY = padding.top + chartHeight - ((avgWpm - minWpm) / yRange) * chartHeight;

  // Accuracy line: second Y-axis on the right, fixed 0–100 range.
  const accPoints = accuracySamples.map((acc, i) => ({
    x: padding.left + i * xStep,
    y: padding.top + chartHeight - (acc / 100) * chartHeight,
  }));
  const accPathD = accPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
    const val = Math.round(minWpm + (yRange * i) / yTickCount);
    const y = padding.top + chartHeight - (((val - minWpm) / yRange) * chartHeight);
    return { val, y };
  });

  const xTickInterval = Math.max(1, Math.ceil(samples.length / 10));
  const xTicks = samples
    .map((_, i) => ({ label: i + 1, x: padding.left + i * xStep }))
    .filter((_, i) => (i + 1) % xTickInterval === 0 || i === 0 || i === samples.length - 1);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-8">
      <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
          {availableModes.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedMode(m.key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedMode === m.key
                  ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      <h3 className="text-sm text-gray-400 mb-3 text-center uppercase tracking-wider">WPM Trend - {selectedLabel}</h3>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {yTicks.map((tick) => (
          <line
            key={`grid-${tick.val}`}
            x1={padding.left}
            y1={tick.y}
            x2={viewBoxWidth - padding.right}
            y2={tick.y}
            stroke="#1f2937"
            strokeWidth="1"
          />
        ))}

        <line
          x1={padding.left}
          y1={avgY}
          x2={viewBoxWidth - padding.right}
          y2={avgY}
          stroke="#bf00ff"
          strokeWidth="1"
          strokeDasharray="6 4"
          opacity="0.6"
        />
        <text
          x={viewBoxWidth - padding.right + 2}
          y={avgY - 4}
          fill="#bf00ff"
          fontSize="9"
          opacity="0.8"
        >
          avg
        </text>

        <path
          d={`${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`}
          fill="url(#trendGradient)"
          opacity="0.15"
        />

        <path
          d={pathD}
          fill="none"
          stroke="#00f0ff"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p, i) => (
          <circle
            key={`dot-${i}`}
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill="#00f0ff"
            opacity="0.7"
          />
        ))}

        {/* Accuracy line (right-axis, 0–100 scale) */}
        <path
          d={accPathD}
          fill="none"
          stroke="#ffbe0b"
          strokeWidth="2"
          strokeDasharray="4 3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {accPoints.map((p, i) => (
          <circle
            key={`acc-dot-${i}`}
            cx={p.x}
            cy={p.y}
            r="2"
            fill="#ffbe0b"
            opacity="0.8"
          />
        ))}

        {/* Right-side accuracy axis labels (0%, 25%, 50%, 75%, 100%) */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const y = padding.top + chartHeight - (pct / 100) * chartHeight;
          return (
            <text
              key={`acc-label-${pct}`}
              x={viewBoxWidth - padding.right + 6}
              y={y + 3}
              fill="#ffbe0b"
              fontSize="9"
              opacity="0.8"
            >
              {pct}%
            </text>
          );
        })}

        {yTicks.map((tick) => (
          <text
            key={`ylabel-${tick.val}`}
            x={padding.left - 8}
            y={tick.y + 3}
            fill="#6b7280"
            fontSize="10"
            textAnchor="end"
          >
            {tick.val}
          </text>
        ))}

        {xTicks.map((tick) => (
          <text
            key={`xlabel-${tick.label}`}
            x={tick.x}
            y={viewBoxHeight - 5}
            fill="#6b7280"
            fontSize="10"
            textAnchor="middle"
          >
            #{tick.label}
          </text>
        ))}

        <text
          x={viewBoxWidth / 2}
          y={viewBoxHeight}
          fill="#4b5563"
          fontSize="10"
          textAnchor="middle"
        >
          Game Number
        </text>
        <text
          x={8}
          y={viewBoxHeight / 2}
          fill="#4b5563"
          fontSize="10"
          textAnchor="middle"
          transform={`rotate(-90, 8, ${viewBoxHeight / 2})`}
        >
          WPM
        </text>

        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2 text-xs">
        <span className="flex items-center gap-2 text-neon-blue">
          <span className="inline-block w-4 h-0.5 bg-neon-blue" aria-hidden="true" />
          WPM
        </span>
        <span className="flex items-center gap-2 text-neon-yellow">
          <span
            className="inline-block w-4 h-0.5 bg-neon-yellow"
            style={{ borderTop: '2px dashed currentColor', height: 0 }}
            aria-hidden="true"
          />
          Accuracy
        </span>
      </div>
    </div>
  );
}

export default function StatsPage() {
  const { anonymousId, resetIdentity } = usePlayer();
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [summary, setSummary] = useState<ScoresSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  // After a successful deletion we hold the "empty" state locally so the
  // UI doesn't flash the pre-delete content while the component re-renders
  // with the freshly regenerated anonymousId from PlayerProvider.
  const [justDeleted, setJustDeleted] = useState(false);

  const fetchScores = useCallback(async (pageIndex: number) => {
    if (!anonymousId) return;
    setLoading(true);
    setError('');
    try {
      const offset = pageIndex * PAGE_SIZE;
      const url = `/api/scores?offset=${offset}&limit=${PAGE_SIZE}`;
      const res = await fetch(url, {
        headers: { 'X-Anonymous-Id': anonymousId },
      });
      if (!res.ok) throw new Error('Failed to fetch scores');
      const data = await res.json();
      setScores(data.scores || []);
      setSummary(data.summary || null);
      setTotal(typeof data.total === 'number' ? data.total : 0);
    } catch {
      setError('Failed to load your stats. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [anonymousId]);

  useEffect(() => {
    if (justDeleted) return;
    fetchScores(page);
  }, [fetchScores, page, justDeleted]);

  // Reset the visible page when the player changes (e.g. after a delete
  // regenerates the anonymousId) so we always land on page 1 for the new
  // identity.
  useEffect(() => {
    setPage(0);
  }, [anonymousId]);

  const handleDelete = async () => {
    if (!anonymousId) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/scores', {
        method: 'DELETE',
        headers: { 'X-Anonymous-Id': anonymousId },
      });
      if (!res.ok) {
        let message = 'Failed to delete your data. Please try again.';
        try {
          const body = await res.json();
          if (body && typeof body.error === 'string') message = body.error;
        } catch {
          /* ignore JSON parse errors */
        }
        setDeleteError(message);
        setDeleting(false);
        return;
      }
      // Optimistically clear UI state before regenerating the identity so
      // the empty-state renders immediately.
      setScores([]);
      setSummary(null);
      setTotal(0);
      setPage(0);
      setJustDeleted(true);
      setDeleteOpen(false);
      setDeleting(false);
      resetIdentity();
    } catch {
      setDeleteError('Failed to delete your data. Please try again.');
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Personal bests per duration (timed modes). These are still computed
  // client-side from the current page of scores as a best-effort display.
  // The primary summary cards above them use the server-side aggregates
  // (which cover ALL scores, not just the current page).
  const durations = [15, 30, 60, 120];
  const personalBests = durations.map((d) => {
    const filtered = scores.filter((s) => s.duration_seconds === d && (!s.game_mode || s.game_mode === 'classic'));
    if (filtered.length === 0) return { duration: d, wpm: null };
    const best = filtered.reduce((a, b) => (a.wpm > b.wpm ? a : b));
    return { duration: d, wpm: best.wpm };
  });

  // Personal bests per word count mode
  const wordModes = [
    { mode: 'words-10', label: '10w' },
    { mode: 'words-25', label: '25w' },
    { mode: 'words-50', label: '50w' },
    { mode: 'words-100', label: '100w' },
  ];
  const wordModeBests = wordModes.map(({ mode, label }) => {
    const filtered = scores.filter((s) => s.game_mode === mode);
    if (filtered.length === 0) return { mode, label, wpm: null, completionTime: null };
    const best = filtered.reduce((a, b) => (a.wpm > b.wpm ? a : b));
    return { mode, label, wpm: best.wpm, completionTime: best.duration_seconds };
  });

  // Summary cards source of truth: server-side aggregates computed over
  // ALL of the player's scores (not just the current page). Fall back to
  // zeros when the server hasn't responded with a summary yet.
  const totalGames = summary?.totalGames ?? 0;
  const totalTimeSeconds = summary?.totalTimeSeconds ?? 0;
  const totalMinutes = Math.floor(totalTimeSeconds / 60);
  const averageWpm = summary?.averageWpm ?? 0;
  const averageAccuracy = summary
    ? summary.averageAccuracy.toFixed(1)
    : '0.0';
  const totalCharactersTyped = summary?.totalCharacters ?? 0;
  const bestSingleGameWpm = summary?.bestWpm ?? 0;
  const bestSingleGameAccuracy = summary?.bestAccuracy ?? 0;

  // Improvement rate: compare the average WPM of the 5 most-recent games
  // against the 5 games immediately before them. The scores array is
  // returned newest-first from the API, so `recent` is the head slice.
  // Falls back to null when there are not enough games to make the
  // comparison meaningful.
  const improvement = (() => {
    if (totalGames < 6) return null;
    const recent = scores.slice(0, 5);
    const previous = scores.slice(5, 10);
    if (previous.length === 0) return null;
    const avg = (arr: ScoreEntry[]) => arr.reduce((s, x) => s + x.wpm, 0) / arr.length;
    const recentAvg = avg(recent);
    const previousAvg = avg(previous);
    const deltaWpm = recentAvg - previousAvg;
    const pct = previousAvg > 0 ? (deltaWpm / previousAvg) * 100 : 0;
    return {
      recentAvg: Math.round(recentAvg),
      previousAvg: Math.round(previousAvg),
      deltaWpm: Math.round(deltaWpm),
      pct: Math.round(pct),
      sampleSize: Math.min(previous.length, 5),
    };
  })();


  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-bold text-center mb-8">
        <span className="text-neon-green">Your</span>{' '}
        <span className="text-gray-300">Stats</span>
      </h1>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-20">
          <div className="inline-block w-8 h-8 border-2 border-neon-green/30 border-t-neon-green rounded-full animate-spin" />
          <p className="text-gray-500 mt-4">Loading your stats...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-20">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => fetchScores(page)}
            className="mt-4 px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && scores.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">&#x1F4CA;</div>
          <p className="text-gray-400 text-lg">No games played yet</p>
          <p className="text-gray-600 text-sm mt-2">Complete a typing test and save your score to see stats here.</p>
          <a
            href="/game?duration=60"
            className="inline-block mt-6 px-6 py-2.5 bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-lg hover:bg-neon-green/30 transition-colors font-medium"
          >
            Start a Test
          </a>
        </div>
      )}

      {/* Stats Content */}
      {!loading && !error && scores.length > 0 && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-gray-900/80 border border-neon-blue/20 rounded-xl p-4 text-center">
              <div className="text-4xl font-bold text-neon-blue">{totalGames}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Games Played</div>
            </div>
            <div className="bg-gray-900/80 border border-neon-purple/20 rounded-xl p-4 text-center">
              <div className="text-4xl font-bold text-neon-purple">{totalMinutes}m</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Time Typing</div>
            </div>
            <div className="bg-gray-900/80 border border-neon-green/20 rounded-xl p-4 text-center">
              <div className="text-4xl font-bold text-neon-green">{averageWpm}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Average WPM</div>
            </div>
            <div className="bg-gray-900/80 border border-neon-yellow/20 rounded-xl p-4 text-center">
              <div className="text-4xl font-bold text-neon-yellow">{averageAccuracy}%</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Average Accuracy</div>
            </div>
          </div>

          {/* Extra summary stats: total characters typed + single-game bests */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-900/80 border border-neon-pink/20 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-neon-pink">
                {totalCharactersTyped.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Total Characters Typed</div>
            </div>
            <div className="bg-gray-900/80 border border-neon-green/30 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-neon-green">{bestSingleGameWpm}</div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Best Single-Game WPM</div>
            </div>
            <div className="bg-gray-900/80 border border-neon-yellow/30 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-neon-yellow">
                {Number.isFinite(bestSingleGameAccuracy)
                  ? bestSingleGameAccuracy.toFixed(1)
                  : '0.0'}
                %
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Best Single-Game Accuracy</div>
            </div>
          </div>

          {/* Improvement rate (last 5 games vs. previous 5) */}
          {improvement && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-8">
              <h3 className="text-sm text-gray-400 mb-3 text-center uppercase tracking-wider">
                Improvement Rate
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-gray-300">{improvement.previousAvg}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">
                    Previous 5 avg WPM
                  </div>
                </div>
                <div className="text-gray-600 text-2xl">&#x2192;</div>
                <div>
                  <div className="text-2xl font-bold text-gray-100">{improvement.recentAvg}</div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">
                    Recent 5 avg WPM
                  </div>
                </div>
                <div>
                  <div
                    className={`text-2xl font-bold ${
                      improvement.deltaWpm > 0
                        ? 'text-neon-green'
                        : improvement.deltaWpm < 0
                          ? 'text-red-400'
                          : 'text-gray-400'
                    }`}
                  >
                    {improvement.deltaWpm > 0 ? '+' : ''}
                    {improvement.deltaWpm} WPM
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({improvement.pct > 0 ? '+' : ''}
                      {improvement.pct}%)
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Change</div>
                </div>
              </div>
            </div>
          )}

          {/* Personal Bests */}
          <h2 className="text-lg font-semibold text-gray-300 mb-4">Personal Bests</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {personalBests.map((pb) => (
              <div key={pb.duration} className="bg-gray-900/80 border border-neon-green/20 rounded-xl p-4 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{pb.duration}s</div>
                <div className="text-3xl font-bold text-neon-green">
                  {pb.wpm !== null ? pb.wpm : '\u2014'}
                </div>
                <div className="text-xs text-gray-500 mt-1">WPM</div>
              </div>
            ))}
          </div>

          {/* Word Mode Bests */}
          <h2 className="text-lg font-semibold text-gray-300 mb-4">Word Mode Bests</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {wordModeBests.map((wb) => (
              <div key={wb.mode} className="bg-gray-900/80 border border-neon-blue/20 rounded-xl p-4 text-center">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{wb.label}</div>
                <div className="text-3xl font-bold text-neon-blue">
                  {wb.wpm !== null ? wb.wpm : '\u2014'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {wb.wpm !== null ? `${wb.completionTime}s · WPM` : 'WPM'}
                </div>
              </div>
            ))}
          </div>

          {/* WPM Trend Chart */}
          <WpmTrendChart scores={scores} />

          {/* Recent Games Table */}
          <h2 className="text-lg font-semibold text-gray-300 mb-4">Recent Games</h2>
          <div className="overflow-x-auto mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium">WPM</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium">Accuracy</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium hidden sm:table-cell">Mode</th>
                  <th className="text-left py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium">Duration</th>
                  <th className="text-right py-3 px-4 text-xs text-gray-500 uppercase tracking-wider font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((entry) => {
                  const modeLabel = entry.game_mode && entry.game_mode.startsWith('words-')
                    ? `${entry.game_mode.replace('words-', '')}w`
                    : `${entry.duration_seconds}s`;
                  return (
                    <tr key={entry.id} className="border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-neon-green font-bold">{entry.wpm}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-400">{Number(entry.accuracy).toFixed(0)}%</span>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span className="text-gray-500">{modeLabel}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-500">{entry.duration_seconds}s</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-gray-600 text-sm">{formatDate(entry.created_at)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-4 mb-12">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
                className="px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &larr; Previous
              </button>
              <span className="text-xs text-gray-500 tabular-nums">
                Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                <span className="hidden sm:inline">
                  {' '}
                  &middot; Showing {page * PAGE_SIZE + 1}
                  &ndash;
                  {Math.min(total, page * PAGE_SIZE + scores.length)} of {total}
                </span>
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= total || loading}
                className="px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next &rarr;
              </button>
            </div>
          )}

          {/* Danger zone: delete personal data */}
          <div className="mt-12 border-t border-gray-800 pt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Danger Zone
            </h2>
            <div className="bg-gray-900/50 border border-red-500/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-gray-300 text-sm font-medium">Delete My Data</div>
                <div className="text-gray-500 text-xs mt-1">
                  Permanently remove all your scores and reset your local identity. This cannot be undone.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeleteError('');
                  setDeleteOpen(true);
                }}
                className="px-4 py-2 text-sm bg-red-500/20 text-red-300 border border-red-500/40 rounded-lg hover:bg-red-500/30 transition-colors font-medium"
              >
                Delete My Data
              </button>
            </div>
          </div>
        </>
      )}

      {/* Show the danger zone on the empty state too when the user has
          just deleted their data (rare path) or when they've played no
          games yet but still want to reset the local identity. */}
      {!loading && !error && scores.length === 0 && !justDeleted && total === 0 && (
        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={() => {
              setDeleteError('');
              setDeleteOpen(true);
            }}
            className="text-xs text-gray-600 hover:text-gray-400 underline underline-offset-2"
          >
            Delete My Data
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-data-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          onClick={() => {
            if (!deleting) setDeleteOpen(false);
          }}
        >
          <div
            className="bg-gray-900 border border-red-500/40 rounded-xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-data-title" className="text-lg font-semibold text-red-400 mb-2">
              Delete your data?
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              This will permanently remove <strong>all</strong> of your scores from the
              leaderboard and clear your local identity. You will get a brand-new anonymous
              ID on your next game. This action is irreversible.
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-3" role="alert">
                {deleteError}
              </p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-500/30 text-red-200 border border-red-500/50 rounded-lg hover:bg-red-500/40 transition-colors disabled:opacity-50 font-semibold"
              >
                {deleting ? 'Deleting…' : 'Yes, delete everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
