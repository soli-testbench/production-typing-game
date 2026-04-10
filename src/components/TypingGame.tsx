'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { passages } from '@/data/passages';
import { ResultsScreen } from '@/components/ResultsScreen';

interface TypingGameProps {
  duration: number;
}

type GameState = 'waiting' | 'running' | 'finished';

export interface GameResult {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  duration: number;
  correctChars: number;
  incorrectChars: number;
  totalChars: number;
  passage: string;
  wpmSamples: number[];
}

interface PassageRecord {
  text: string;
  typed: string;
}

function getRandomPassage(exclude?: string): string {
  const available = exclude ? passages.filter((p) => p !== exclude) : passages;
  return available[Math.floor(Math.random() * available.length)];
}

export function TypingGame({ duration }: TypingGameProps) {
  const [currentPassage, setCurrentPassage] = useState(() => getRandomPassage());
  const [typed, setTyped] = useState('');
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [timeLeft, setTimeLeft] = useState(duration);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [currentDuration, setCurrentDuration] = useState(duration);
  const [completedPassages, setCompletedPassages] = useState<PassageRecord[]>([]);
  const [wpmSamples, setWpmSamples] = useState<number[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentCharRef = useRef<HTMLSpanElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);

  // Refs for accumulated stats across passages
  const accumulatedCorrectRef = useRef(0);
  const accumulatedIncorrectRef = useRef(0);
  const accumulatedTotalRef = useRef(0);

  const calculateAggregateStats = useCallback(() => {
    let currentCorrect = 0;
    let currentIncorrect = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === currentPassage[i]) {
        currentCorrect++;
      } else {
        currentIncorrect++;
      }
    }
    const totalCorrect = accumulatedCorrectRef.current + currentCorrect;
    const totalIncorrect = accumulatedIncorrectRef.current + currentIncorrect;
    const totalChars = accumulatedTotalRef.current + typed.length;
    const elapsedMinutes = currentDuration / 60;
    const wpm = Math.round(totalCorrect / 5 / elapsedMinutes);
    const rawWpm = Math.round(totalChars / 5 / elapsedMinutes);
    const accuracy = totalChars > 0 ? Math.round((totalCorrect / totalChars) * 100) : 0;

    return { wpm, rawWpm, accuracy, correctChars: totalCorrect, incorrectChars: totalIncorrect, totalChars };
  }, [typed, currentPassage, currentDuration]);

  const finishGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const stats = calculateAggregateStats();
    const allPassageText = [
      ...completedPassages.map((p) => p.text),
      currentPassage,
    ].join(' | ');
    setResult({
      ...stats,
      duration: currentDuration,
      passage: allPassageText,
      wpmSamples,
    });
    setGameState('finished');
  }, [calculateAggregateStats, currentDuration, currentPassage, completedPassages, wpmSamples]);

  const resetGame = useCallback((options?: { newPassage?: boolean; newDuration?: number }) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const duration = options?.newDuration ?? currentDuration;
    if (options?.newDuration !== undefined) {
      setCurrentDuration(duration);
    }
    if (options?.newPassage || options?.newDuration !== undefined) {
      setCurrentPassage(getRandomPassage(currentPassage));
    }
    setTyped('');
    setGameState('waiting');
    setTimeLeft(duration);
    setStartTime(null);
    setResult(null);
    setCompletedPassages([]);
    setWpmSamples([]);
    accumulatedCorrectRef.current = 0;
    accumulatedIncorrectRef.current = 0;
    accumulatedTotalRef.current = 0;
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [currentDuration, currentPassage]);

  const startGame = useCallback(() => {
    setGameState('running');
    setStartTime(Date.now());
    setTimeLeft(currentDuration);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [currentDuration]);

  // Sample WPM every second when game is running
  useEffect(() => {
    if (gameState !== 'running' || !startTime) return;

    const sampleInterval = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      const elapsedMinutes = elapsedMs / 1000 / 60;
      if (elapsedMinutes < 0.01) return;

      let currentCorrect = 0;
      const typedVal = inputRef.current?.value || '';
      for (let i = 0; i < typedVal.length; i++) {
        if (typedVal[i] === currentPassage[i]) currentCorrect++;
      }

      const totalCorrect = accumulatedCorrectRef.current + currentCorrect;
      const currentWpm = Math.round(totalCorrect / 5 / elapsedMinutes);
      setWpmSamples((prev) => [...prev, currentWpm]);
    }, 1000);

    return () => clearInterval(sampleInterval);
  }, [gameState, startTime, currentPassage]);

  // Handle timer reaching 0
  useEffect(() => {
    if (timeLeft === 0 && gameState === 'running') {
      finishGame();
    }
  }, [timeLeft, gameState, finishGame]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle duration change from URL
  useEffect(() => {
    if (duration !== currentDuration) {
      resetGame({ newDuration: duration });
    }
  }, [duration, currentDuration, resetGame]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        resetGame();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        resetGame({ newPassage: true });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetGame]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [gameState]);

  // Auto-scroll to current typing position
  useEffect(() => {
    if (currentCharRef.current) {
      currentCharRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [typed]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (gameState === 'finished') return;

    const value = e.target.value;

    if (gameState === 'waiting' && value.length > 0) {
      startGame();
    }

    // Don't allow typing beyond current passage length
    if (value.length <= currentPassage.length) {
      setTyped(value);
    }

    // If typed all characters of current passage, chain to next passage
    if (value.length >= currentPassage.length) {
      // Calculate stats for completed passage
      let correct = 0;
      let incorrect = 0;
      for (let i = 0; i < currentPassage.length; i++) {
        if (value[i] === currentPassage[i]) {
          correct++;
        } else {
          incorrect++;
        }
      }

      // Accumulate stats
      accumulatedCorrectRef.current += correct;
      accumulatedIncorrectRef.current += incorrect;
      accumulatedTotalRef.current += currentPassage.length;

      // Record completed passage
      const completedTyped = value.slice(0, currentPassage.length);
      const completedText = currentPassage;
      setCompletedPassages((prev) => [...prev, { text: completedText, typed: completedTyped }]);

      // Load next passage
      const nextPassage = getRandomPassage(currentPassage);
      setCurrentPassage(nextPassage);
      setTyped('');

      // Reset the textarea value directly
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  // Calculate live WPM (aggregate across passages)
  const liveWpm = (() => {
    if (!startTime || gameState !== 'running') return 0;
    const elapsed = (Date.now() - startTime) / 1000 / 60;
    if (elapsed < 0.01) return 0;
    let correct = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === currentPassage[i]) correct++;
    }
    const totalCorrect = accumulatedCorrectRef.current + correct;
    return Math.round(totalCorrect / 5 / elapsed);
  })();

  const liveAccuracy = (() => {
    const totalTyped = accumulatedTotalRef.current + typed.length;
    if (totalTyped === 0) return 100;
    let correct = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === currentPassage[i]) correct++;
    }
    const totalCorrect = accumulatedCorrectRef.current + correct;
    return Math.round((totalCorrect / totalTyped) * 100);
  })();

  if (result && gameState === 'finished') {
    return (
      <ResultsScreen
        result={result}
        onRetry={() => resetGame()}
        onNewTest={() => resetGame({ newPassage: true })}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Stats Bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-neon-blue">{timeLeft}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">seconds</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-neon-green">{liveWpm}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">WPM</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-neon-purple">{liveAccuracy}%</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">accuracy</div>
          </div>
        </div>

        {/* Duration selector */}
        <div className="flex items-center gap-2">
          {[15, 30, 60, 120].map((d) => (
            <button
              key={d}
              onClick={() => resetGame({ newDuration: d })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                currentDuration === d
                  ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      {/* Typing Area */}
      <div
        className="relative bg-gray-900/50 border border-gray-800 rounded-xl p-6 md:p-8 cursor-text max-h-64 overflow-y-auto"
        onClick={() => inputRef.current?.focus()}
        ref={textDisplayRef}
      >
        {gameState === 'waiting' && typed.length === 0 && completedPassages.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <p className="text-gray-500 text-lg">Click here or start typing to begin...</p>
          </div>
        )}

        {/* Text Display */}
        <div className="text-lg md:text-xl leading-relaxed tracking-wide select-none" aria-hidden="true">
          {/* Previously completed passages */}
          {completedPassages.map((record, pIndex) => (
            <span key={`passage-${pIndex}`}>
              {record.text.split('').map((char, index) => {
                const wasCorrect = record.typed[index] === char;
                return (
                  <span
                    key={`p${pIndex}-${index}`}
                    className={wasCorrect ? 'text-neon-green/50' : 'text-red-500/50'}
                  >
                    {char}
                  </span>
                );
              })}
              <span className="text-gray-700 mx-2">|</span>
            </span>
          ))}

          {/* Current passage */}
          {currentPassage.split('').map((char, index) => {
            let className = 'text-gray-600';
            const isCursor = index === typed.length;
            if (index < typed.length) {
              className = typed[index] === char
                ? 'text-neon-green'
                : 'text-red-500 bg-red-500/10';
            } else if (isCursor) {
              className = 'text-gray-300 border-l-2 border-neon-blue cursor-blink';
            }
            return (
              <span
                key={`current-${index}`}
                className={className}
                ref={isCursor ? currentCharRef : undefined}
              >
                {char}
              </span>
            );
          })}
        </div>

        {/* Hidden Input */}
        <textarea
          ref={inputRef}
          value={typed}
          onChange={handleInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text resize-none"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Type the displayed text here"
        />
      </div>

      {/* Progress Bar (per-passage) */}
      <div className="mt-4 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-neon-blue to-neon-purple transition-all duration-100"
          style={{ width: `${(typed.length / currentPassage.length) * 100}%` }}
        />
      </div>

      {/* Passage indicator */}
      {completedPassages.length > 0 && (
        <div className="mt-2 text-xs text-gray-600 text-center">
          Passage {completedPassages.length + 1}
        </div>
      )}

      {/* Hints */}
      <div className="mt-6 flex justify-center gap-6 text-xs text-gray-600">
        <span>
          <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">Tab</kbd> restart
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">Esc</kbd> new test
        </span>
      </div>
    </div>
  );
}
