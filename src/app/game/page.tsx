'use client';

import { Suspense, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TypingGame } from '@/components/TypingGame';

const CUSTOM_MIN_LENGTH = 10;
const CUSTOM_MAX_LENGTH = 5000;

function CustomTextEntry({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const charCount = value.length;
  const trimmedCount = trimmed.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmed) {
      setError('Please enter some text to type.');
      return;
    }
    if (trimmedCount < CUSTOM_MIN_LENGTH) {
      setError(`Passage must be at least ${CUSTOM_MIN_LENGTH} characters (you have ${trimmedCount}).`);
      return;
    }
    if (charCount > CUSTOM_MAX_LENGTH) {
      setError(`Passage must be at most ${CUSTOM_MAX_LENGTH} characters (you have ${charCount}).`);
      return;
    }
    setError(null);
    // Normalize whitespace: collapse runs of whitespace (including newlines)
    // to single spaces so the passage renders consistently and the typing
    // UI does not have to handle arbitrary line breaks the user pasted in.
    const normalized = trimmed.replace(/\s+/g, ' ');
    onSubmit(normalized);
  };

  const overLimit = charCount > CUSTOM_MAX_LENGTH;
  const underLimit = trimmedCount > 0 && trimmedCount < CUSTOM_MIN_LENGTH;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          <span className="text-neon-pink">Custom</span>{' '}
          <span className="text-gray-300">Text</span>
        </h1>
        <p className="text-gray-400 text-sm">
          Paste or write your own passage below. Custom tests always run in
          practice mode — scores are not saved to the leaderboard.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900/80 border border-neon-pink/30 rounded-xl p-6">
        <label htmlFor="custom-text" className="block text-sm text-gray-400 mb-2 uppercase tracking-wider">
          Your passage
        </label>
        <textarea
          id="custom-text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Paste or type the passage you want to practice..."
          rows={8}
          maxLength={CUSTOM_MAX_LENGTH}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg p-4 text-gray-100 font-mono text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-neon-pink/60 focus:border-neon-pink/60 resize-y"
          autoFocus
        />
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span
            className={`${overLimit || underLimit ? 'text-neon-pink' : 'text-gray-500'}`}
            aria-live="polite"
          >
            {charCount} / {CUSTOM_MAX_LENGTH} characters
            {underLimit ? ` (need at least ${CUSTOM_MIN_LENGTH})` : ''}
          </span>
          <span className="text-gray-600">
            min {CUSTOM_MIN_LENGTH} · max {CUSTOM_MAX_LENGTH}
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 px-3 py-2 bg-red-950/40 border border-red-500/40 rounded text-red-300 text-sm"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-6">
          <Link
            href="/"
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            ← Back to modes
          </Link>
          <button
            type="submit"
            className="px-6 py-2 bg-neon-pink/10 border border-neon-pink/60 hover:bg-neon-pink/20 text-neon-pink font-semibold rounded-lg transition-colors"
          >
            Start Typing →
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-gray-600 text-xs">
        Tip: Press <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400">Tab</kbd> during
        the test to restart with the same text, or{' '}
        <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400">Esc</kbd> to return here.
      </p>
    </div>
  );
}

function GameContent() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const durationParam = searchParams.get('duration');
  const wordCountParam = searchParams.get('wordCount');
  const practiceParam = searchParams.get('practice');
  const initialPracticeMode = practiceParam === 'true' || practiceParam === '1';

  const [customText, setCustomText] = useState<string | null>(null);

  const handleExitCustom = useCallback(() => {
    setCustomText(null);
  }, []);

  if (modeParam === 'custom') {
    if (customText === null) {
      return <CustomTextEntry onSubmit={setCustomText} />;
    }
    return (
      <TypingGame
        mode="time"
        duration={0}
        customText={customText}
        onExit={handleExitCustom}
        initialPracticeMode={true}
      />
    );
  }

  if (modeParam === 'words') {
    const wordCount = [10, 25, 50, 100].includes(Number(wordCountParam))
      ? Number(wordCountParam)
      : 25;
    return (
      <TypingGame
        mode="words"
        wordCount={wordCount}
        duration={0}
        initialPracticeMode={initialPracticeMode}
      />
    );
  }

  const duration = [15, 30, 60, 120].includes(Number(durationParam))
    ? Number(durationParam)
    : 60;

  return (
    <TypingGame
      mode="time"
      duration={duration}
      initialPracticeMode={initialPracticeMode}
    />
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-500 mt-20">Loading...</div>}>
      <GameContent />
    </Suspense>
  );
}
