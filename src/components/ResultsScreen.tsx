'use client';

import { useEffect, useState } from 'react';
import { usePlayer } from '@/components/PlayerProvider';
import { NameEntryModal } from '@/components/NameEntryModal';

interface GameResult {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  duration: number;
  correctChars: number;
  incorrectChars: number;
  totalChars: number;
  passage: string;
}

interface ResultsScreenProps {
  result: GameResult;
  onRetry: () => void;
  onNewTest: () => void;
}

export function ResultsScreen({ result, onRetry, onNewTest }: ResultsScreenProps) {
  const { playerName, anonymousId, isNameSet } = usePlayer();
  const [showNameModal, setShowNameModal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const saveScore = async () => {
    if (saving || saved) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName,
          anonymousId,
          gameMode: 'classic',
          wpm: result.wpm,
          rawWpm: result.rawWpm,
          accuracy: result.accuracy,
          durationSeconds: result.duration,
          correctChars: result.correctChars,
          incorrectChars: result.incorrectChars,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save score');
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save score');
    } finally {
      setSaving(false);
    }
  };

  // Auto-save when name is set
  useEffect(() => {
    if (isNameSet && !saved && !saving) {
      saveScore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNameSet]);

  // Keyboard shortcuts for results screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [onRetry, onNewTest]);

  const handleSaveClick = () => {
    if (!isNameSet) {
      setShowNameModal(true);
    } else {
      saveScore();
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h2 className="text-3xl font-bold text-center mb-8">
        <span className="text-neon-blue">Test</span>{' '}
        <span className="text-gray-300">Complete</span>
      </h2>

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
          <div className="text-4xl font-bold text-neon-yellow">{result.duration}s</div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mt-1">Duration</div>
        </div>
      </div>

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

      {/* Save Score */}
      {!saved && (
        <div className="text-center mb-6">
          <button
            onClick={handleSaveClick}
            disabled={saving}
            className="px-6 py-2.5 bg-neon-blue/20 text-neon-blue border border-neon-blue/30 rounded-lg hover:bg-neon-blue/30 transition-colors disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : 'Save Score to Leaderboard'}
          </button>
          {saveError && <p className="text-red-400 text-sm mt-2">{saveError}</p>}
        </div>
      )}
      {saved && (
        <div className="text-center mb-6">
          <p className="text-neon-green text-sm">Score saved to leaderboard!</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
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
      </div>

      {showNameModal && (
        <NameEntryModal
          onClose={() => setShowNameModal(false)}
          onSaved={() => {
            // After name is saved, auto-save will trigger via useEffect
          }}
        />
      )}
    </div>
  );
}
