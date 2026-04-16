'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePlayer } from '@/components/PlayerProvider';
import { NameEntryModal } from '@/components/NameEntryModal';
import { GameResult, TroubleCharacter } from '@/types/game';

interface PersonalBestInfo {
  isNewBest: boolean;
  isFirstScore: boolean;
  isTied: boolean;
  improvement: number;
}

interface ResultsScreenProps {
  result: GameResult;
  onRetry: () => void;
  onNewTest: () => void;
}

function WpmChart({ samples, averageWpm }: { samples: number[]; averageWpm: number }) {
  if (samples.length < 2) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-8 text-center">
        <p className="text-gray-500 text-sm">Test too short for WPM chart</p>
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 35, left: 45 };
  const viewBoxWidth = 600;
  const viewBoxHeight = 250;
  const chartWidth = viewBoxWidth - padding.left - padding.right;
  const chartHeight = viewBoxHeight - padding.top - padding.bottom;

  const maxWpm = Math.max(...samples, averageWpm, 10);
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

  const avgY = padding.top + chartHeight - ((averageWpm - minWpm) / yRange) * chartHeight;

  // Y-axis tick marks
  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
    const val = Math.round(minWpm + (yRange * i) / yTickCount);
    const y = padding.top + chartHeight - (((val - minWpm) / yRange) * chartHeight);
    return { val, y };
  });

  // X-axis tick marks
  const xTickInterval = Math.max(1, Math.ceil(samples.length / 10));
  const xTicks = samples
    .map((_, i) => ({ sec: i + 1, x: padding.left + i * xStep }))
    .filter((_, i) => (i + 1) % xTickInterval === 0 || i === 0 || i === samples.length - 1);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-8">
      <h3 className="text-sm text-gray-400 mb-3 text-center uppercase tracking-wider">WPM Over Time</h3>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
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

        {/* Average WPM reference line */}
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

        {/* Area fill under the line */}
        <path
          d={`${pathD} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`}
          fill="url(#wpmGradient)"
          opacity="0.15"
        />

        {/* WPM line */}
        <path
          d={pathD}
          fill="none"
          stroke="#00f0ff"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
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

        {/* Y-axis labels */}
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

        {/* X-axis labels */}
        {xTicks.map((tick) => (
          <text
            key={`xlabel-${tick.sec}`}
            x={tick.x}
            y={viewBoxHeight - 5}
            fill="#6b7280"
            fontSize="10"
            textAnchor="middle"
          >
            {tick.sec}s
          </text>
        ))}

        {/* Axis labels */}
        <text
          x={viewBoxWidth / 2}
          y={viewBoxHeight}
          fill="#4b5563"
          fontSize="10"
          textAnchor="middle"
        >
          Time (seconds)
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

        {/* Gradient definition */}
        <defs>
          <linearGradient id="wpmGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function renderPrintableChar(ch: string): string {
  if (ch === ' ') return 'space';
  if (ch === '\n') return 'newline';
  if (ch === '\t') return 'tab';
  return ch;
}

function TroubleCharactersSection({ characters }: { characters: TroubleCharacter[] }) {
  if (!characters || characters.length === 0) {
    return (
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-8">
        <h3 className="text-sm text-gray-400 mb-3 text-center uppercase tracking-wider">
          Trouble Characters
        </h3>
        <p className="text-center text-neon-green text-sm font-medium">
          Perfect accuracy! No errors.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-8">
      <h3 className="text-sm text-gray-400 mb-3 text-center uppercase tracking-wider">
        Trouble Characters
      </h3>
      <ul className="space-y-2">
        {characters.map((c) => {
          const expectedLabel = renderPrintableChar(c.expected);
          const actualLabel = renderPrintableChar(c.mostCommonIncorrect);
          const isSingleExpected = expectedLabel.length === 1;
          const isSingleActual = actualLabel.length === 1;
          return (
            <li
              key={`${c.expected}-${c.mostCommonIncorrect}`}
              className="flex items-center justify-between text-sm bg-gray-900/60 border border-gray-800 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs uppercase tracking-wider">Expected</span>
                <span
                  className={`font-mono text-neon-green ${
                    isSingleExpected ? 'text-lg' : 'text-xs px-1 py-0.5 bg-gray-800 rounded'
                  }`}
                >
                  {expectedLabel}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-xs uppercase tracking-wider">Typed</span>
                <span
                  className={`font-mono text-red-400 ${
                    isSingleActual ? 'text-lg' : 'text-xs px-1 py-0.5 bg-gray-800 rounded'
                  }`}
                >
                  {actualLabel}
                </span>
              </div>
              <div className="text-gray-400 text-xs">
                <span className="text-red-400 font-bold">{c.count}</span>{' '}
                {c.count === 1 ? 'error' : 'errors'}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PersonalBestBanner({ info }: { info: PersonalBestInfo }) {
  if (info.isFirstScore) {
    return (
      <div className="mb-6 animate-slide-up">
        <div className="bg-neon-blue/10 border border-neon-blue/30 rounded-xl p-4 text-center">
          <div className="text-2xl mb-1">🌟</div>
          <p className="text-neon-blue font-bold text-lg">First score at this duration!</p>
          <p className="text-gray-400 text-sm mt-1">Keep playing to set your personal best</p>
        </div>
      </div>
    );
  }

  if (info.isNewBest) {
    return (
      <div className="mb-6 animate-slide-up">
        <div className="bg-neon-green/10 border border-neon-green/30 rounded-xl p-4 text-center">
          <div className="text-2xl mb-1">🎉</div>
          <p className="text-neon-green font-bold text-lg neon-text">New Personal Best!</p>
          <p className="text-neon-yellow text-sm mt-1 font-medium">+{info.improvement} WPM over your previous best</p>
        </div>
      </div>
    );
  }

  if (info.isTied) {
    return (
      <div className="mb-6 animate-slide-up">
        <div className="bg-neon-yellow/10 border border-neon-yellow/30 rounded-xl p-4 text-center">
          <div className="text-2xl mb-1">🎯</div>
          <p className="text-neon-yellow font-bold text-lg">Tied Your Personal Best!</p>
          <p className="text-gray-400 text-sm mt-1">Keep pushing to beat your record</p>
        </div>
      </div>
    );
  }

  return null;
}

export function ResultsScreen({ result, onRetry, onNewTest }: ResultsScreenProps) {
  const { playerName, anonymousId, isNameSet } = usePlayer();
  const [showNameModal, setShowNameModal] = useState(false);
  const autoModalShownRef = useRef(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saveAttemptedRef = useRef(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared' | 'error'>('idle');
  const [personalBest, setPersonalBest] = useState<PersonalBestInfo | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Tracks whether the auto-save path was taken (either the user provided a
  // name, or they dismissed the modal and we saved as "Anonymous"). When
  // true, the explicit "Save Score to Leaderboard" button is hidden so we
  // cannot accidentally submit the same score twice.
  const [autoSaveInitiated, setAutoSaveInitiated] = useState(false);
  const maxRetries = 3;

  // Helper: cancel any pending retry timeout. Called before kicking off a
  // new manual save or on unmount so we never have two concurrent save
  // attempts racing against each other.
  const cancelPendingRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Cleanup retry timeout on unmount
  useEffect(() => {
    return () => {
      cancelPendingRetry();
    };
  }, [cancelPendingRetry]);

  const saveScore = useCallback(async (attempt = 0, nameOverride?: string) => {
    if (saved) return;
    // Any new save attempt (fresh or retry) supersedes any pending retry
    // timeout. This prevents a retry from firing concurrently with a manual
    // click.
    cancelPendingRetry();
    if (attempt === 0) {
      if (saveAttemptedRef.current) return;
      saveAttemptedRef.current = true;
    }
    if (attempt > 0) {
      setRetrying(true);
    }
    setSaving(true);
    setSaveError('');
    const effectivePlayerName = nameOverride ?? playerName;
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: effectivePlayerName,
          anonymousId,
          gameMode: result.gameMode === 'words' ? `words-${result.wordCount}` : 'classic',
          wpm: result.wpm,
          rawWpm: result.rawWpm,
          accuracy: result.accuracy,
          durationSeconds: result.gameMode === 'words' && result.completionTime != null
            ? result.completionTime
            : result.duration,
          correctChars: result.correctChars,
          incorrectChars: result.incorrectChars,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to save score' }));
        const status = res.status;

        // Non-retryable errors
        if (status === 400 || status === 422) {
          throw { message: data.error || 'Validation error', retryable: false };
        }

        // Rate limit: respect Retry-After header
        if (status === 429) {
          const retryAfter = parseInt(res.headers.get('Retry-After') || '5', 10);
          if (attempt < maxRetries) {
            const delay = retryAfter * 1000;
            setRetryCount(attempt + 1);
            setRetrying(true);
            setSaving(false);
            retryTimeoutRef.current = setTimeout(() => {
              saveScore(attempt + 1);
            }, delay);
            return;
          }
          throw { message: data.error || 'Rate limit exceeded', retryable: false };
        }

        // Retryable server errors (503, 500, etc.)
        throw { message: data.error || 'Failed to save score', retryable: true };
      }

      const data = await res.json();

      // Use the personal best info from the save response (Task 1)
      const previousBestWpm: number | null = data.personalBest?.previousBestWpm ?? null;
      if (previousBestWpm === null) {
        setPersonalBest({ isNewBest: false, isFirstScore: true, isTied: false, improvement: 0 });
      } else if (result.wpm > previousBestWpm) {
        setPersonalBest({ isNewBest: true, isFirstScore: false, isTied: false, improvement: result.wpm - previousBestWpm });
      } else if (result.wpm === previousBestWpm) {
        setPersonalBest({ isNewBest: false, isFirstScore: false, isTied: true, improvement: 0 });
      }
      // If result.wpm < previousBestWpm, no personal best banner is shown

      setSaved(true);
      setRetrying(false);
      setRetryCount(0);
    } catch (err) {
      const error = err as { message?: string; retryable?: boolean };
      const errorMessage = error.message || 'Failed to save score';
      const isRetryable = error.retryable !== false;
      const isNetworkError = err instanceof TypeError; // fetch network errors

      if ((isRetryable || isNetworkError) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        setRetryCount(attempt + 1);
        setRetrying(true);
        setSaving(false);
        retryTimeoutRef.current = setTimeout(() => {
          saveScore(attempt + 1);
        }, delay);
        return;
      }

      setSaveError(errorMessage);
      saveAttemptedRef.current = false;
      setRetrying(false);
      setRetryCount(0);
    } finally {
      setSaving(false);
    }
  }, [playerName, anonymousId, result, saved, maxRetries, cancelPendingRetry]);

  // Auto-save when name is already set on mount, or auto-show modal if no name.
  // Skip entirely in practice mode — scores should not be saved.
  useEffect(() => {
    if (result.practiceMode) return;
    if (isNameSet && !saved && !saveAttemptedRef.current) {
      // Mark the auto-save path as taken so the manual Save button is
      // never rendered for users who already had their name set on mount.
      setAutoSaveInitiated(true);
      saveScore();
    } else if (!isNameSet && !autoModalShownRef.current) {
      autoModalShownRef.current = true;
      setShowNameModal(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Called when the name-entry modal is dismissed without a name being set.
  // Auto-save the score under 'Anonymous' so the save flow never hits a dead end.
  // Personal best tracking still works because it is tied to anonymousId, not playerName.
  const handleModalDismiss = useCallback(() => {
    setShowNameModal(false);
    if (!isNameSet && !saved && !saveAttemptedRef.current) {
      // Mark the auto-save path as taken so the manual Save button does not
      // render — preventing a duplicate submission with a different name.
      setAutoSaveInitiated(true);
      saveScore(0, 'Anonymous');
    }
  }, [isNameSet, saved, saveScore]);

  // Keyboard shortcuts for results screen. Tab/Esc are explicitly ignored
  // while the name-entry modal is open so they don't race with the modal's
  // own focus-trap / dismiss handlers even if event propagation leaks
  // through (e.g. React synthetic events vs. native listeners).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showNameModal) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        onRetry();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onNewTest();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRetry, onNewTest, showNameModal]);

  const handleSaveClick = () => {
    // Guard against double-clicks / races: if a save is already in flight
    // (either actively saving or waiting to retry) ignore the click.
    if (saving || retrying || saved) return;
    if (!isNameSet) {
      setShowNameModal(true);
    } else {
      // Ensure any queued retry from a previous failure is cleared so we
      // don't end up with two concurrent requests.
      cancelPendingRetry();
      saveAttemptedRef.current = false;
      saveScore();
    }
  };

  const saveButtonLabel = retrying
    ? `Retrying... (${retryCount}/${maxRetries})`
    : saving
      ? 'Saving...'
      : 'Save Score to Leaderboard';

  const handleShare = async () => {
    const modeDesc = result.gameMode === 'words'
      ? `${result.wordCount}-word test in ${result.completionTime}s`
      : `${result.duration}s test`;
    const shareText = `I just typed ${result.wpm} WPM with ${result.accuracy}% accuracy on a ${modeDesc} on TypeRacer Pro! \uD83C\uDFAF`;

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text: shareText });
        setShareStatus('shared');
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        setShareStatus('copied');
      } else {
        // Fallback: create a temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = shareText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setShareStatus('copied');
      }
    } catch {
      // If share was cancelled or failed, try clipboard
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(shareText);
          setShareStatus('copied');
        }
      } catch {
        setShareStatus('error');
      }
    }

    // Reset status after 2 seconds
    setTimeout(() => setShareStatus('idle'), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h2 className="text-3xl font-bold text-center mb-4">
        <span className="text-neon-blue">Test</span>{' '}
        <span className="text-gray-300">Complete</span>
      </h2>

      {/* Practice Mode Badge */}
      {result.practiceMode && (
        <div className="flex justify-center mb-6">
          <div className="px-4 py-1.5 bg-neon-yellow/10 border border-neon-yellow/40 rounded-full text-neon-yellow text-xs font-semibold uppercase tracking-wider">
            Practice Mode — score not saved
          </div>
        </div>
      )}

      {/* Personal Best Notification */}
      {!result.practiceMode && personalBest && <PersonalBestBanner info={personalBest} />}

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900/80 border border-neon-green/20 rounded-xl p-4 text-center">
          <div className="text-4xl font-bold text-neon-green">{result.wpm}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">WPM</div>
        </div>
        <div className="bg-gray-900/80 border border-neon-blue/20 rounded-xl p-4 text-center">
          <div className="text-4xl font-bold text-neon-blue">{result.rawWpm}</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Raw WPM</div>
        </div>
        <div className="bg-gray-900/80 border border-neon-purple/20 rounded-xl p-4 text-center">
          <div className="text-4xl font-bold text-neon-purple">{result.accuracy}%</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Accuracy</div>
        </div>
        <div className="bg-gray-900/80 border border-neon-yellow/20 rounded-xl p-4 text-center">
          <div className="text-4xl font-bold text-neon-yellow">
            {result.gameMode === 'words' ? `${result.completionTime}s` : `${result.duration}s`}
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">
            {result.gameMode === 'words' ? 'Time' : 'Duration'}
          </div>
        </div>
      </div>

      {/* WPM Over Time Chart */}
      <WpmChart samples={result.wpmSamples} averageWpm={result.wpm} />

      {/* Trouble Characters (per-character error breakdown) */}
      <TroubleCharactersSection characters={result.troubleCharacters ?? []} />

      {/* Character Stats */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mb-8">
        <div className="flex items-center justify-center gap-8 text-sm">
          <div className="text-center">
            <span className="text-neon-green font-bold text-lg">{result.correctChars}</span>
            <p className="text-gray-500 text-xs">Correct</p>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div className="text-center">
            <span className="text-red-400 font-bold text-lg">{result.incorrectChars}</span>
            <p className="text-gray-500 text-xs">Incorrect</p>
          </div>
          <div className="w-px h-8 bg-gray-700" />
          <div className="text-center">
            <span className="text-gray-300 font-bold text-lg">{result.totalChars}</span>
            <p className="text-gray-500 text-xs">Total</p>
          </div>
        </div>
      </div>

      {/* Save Score — hidden in practice mode since no score is saved, and
          also hidden once the auto-save path has been taken (anonymous save
          after modal dismiss, or auto-save with a known name). This prevents
          a user from triggering a duplicate save after the score has already
          been submitted in the background. */}
      {!result.practiceMode && !saved && !autoSaveInitiated && (
        <div className="text-center mb-6">
          <button
            onClick={handleSaveClick}
            disabled={saving || retrying}
            className="px-6 py-2.5 bg-neon-blue/20 text-neon-blue border border-neon-blue/30 rounded-lg hover:bg-neon-blue/30 transition-colors disabled:opacity-50 font-medium"
          >
            {saveButtonLabel}
          </button>
          {saveError && <p className="text-red-400 text-sm mt-2">{saveError}</p>}
        </div>
      )}
      {!result.practiceMode && !saved && autoSaveInitiated && (saving || retrying) && (
        <div className="text-center mb-6">
          <p className="text-gray-400 text-sm">{saveButtonLabel}</p>
        </div>
      )}
      {!result.practiceMode && !saved && autoSaveInitiated && !saving && !retrying && saveError && (
        <div className="text-center mb-6">
          <p className="text-red-400 text-sm">{saveError}</p>
        </div>
      )}
      {!result.practiceMode && saved && (
        <div className="text-center mb-6">
          <p className="text-neon-green text-sm">Score saved to leaderboard!</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4 flex-wrap">
        <button
          onClick={onRetry}
          className="px-6 py-2.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          Retry Same Text
          <span className="text-xs text-gray-500 ml-2">(Tab)</span>
        </button>
        <button
          onClick={onNewTest}
          className="px-6 py-2.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          New Test
          <span className="text-xs text-gray-500 ml-2">(Esc)</span>
        </button>
        <button
          onClick={handleShare}
          className="px-6 py-2.5 bg-neon-purple/20 text-neon-purple border border-neon-purple/30 rounded-lg hover:bg-neon-purple/30 transition-colors font-medium"
        >
          {shareStatus === 'copied' ? 'Copied!' : shareStatus === 'shared' ? 'Shared!' : shareStatus === 'error' ? 'Failed' : 'Share Results'}
        </button>
      </div>

      {!result.practiceMode && showNameModal && (
        <NameEntryModal
          onClose={handleModalDismiss}
          onSaved={() => {
            setShowNameModal(false);
            // Name was just set — kick off the auto-save path so the
            // button is also hidden in this branch.
            setAutoSaveInitiated(true);
            saveScore();
          }}
        />
      )}
    </div>
  );
}
