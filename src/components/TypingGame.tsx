'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { passages } from '@/data/passages';
import { ResultsScreen } from '@/components/ResultsScreen';
import { GameResult } from '@/types/game';

export type { GameResult } from '@/types/game';

interface TypingGameProps {
  mode?: 'time' | 'words';
  duration: number;
  wordCount?: number;
  initialPracticeMode?: boolean;
}

type GameState = 'waiting' | 'running' | 'finished';

interface PassageRecord {
  text: string;
  typed: string;
}

function getRandomPassage(exclude?: string): string {
  const available = exclude ? passages.filter((p) => p !== exclude) : passages;
  return available[Math.floor(Math.random() * available.length)];
}

function generateWordPassage(count: number): string {
  const allWords: string[] = [];
  for (const p of passages) {
    for (const w of p.split(/\s+/)) {
      // Strip leading/trailing punctuation and lowercase
      const cleaned = w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').toLowerCase();
      // Filter out empty strings and single-character artifacts
      if (cleaned.length > 1) allWords.push(cleaned);
    }
  }
  const selected: string[] = [];
  for (let i = 0; i < count; i++) {
    let word: string;
    // Prevent consecutive duplicate words
    do {
      word = allWords[Math.floor(Math.random() * allWords.length)];
    } while (selected.length > 0 && word === selected[selected.length - 1]);
    selected.push(word);
  }
  return selected.join(' ');
}

export function TypingGame({ mode = 'time', duration, wordCount, initialPracticeMode = false }: TypingGameProps) {
  const isWordMode = mode === 'words';
  const [currentPassage, setCurrentPassage] = useState(() =>
    isWordMode && wordCount ? generateWordPassage(wordCount) : getRandomPassage()
  );
  const [typed, setTyped] = useState('');
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [timeLeft, setTimeLeft] = useState(duration);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [currentDuration, setCurrentDuration] = useState(duration);
  const [currentWordCount, setCurrentWordCount] = useState(wordCount);
  const [completedPassages, setCompletedPassages] = useState<PassageRecord[]>([]);
  const [wpmSamples, setWpmSamples] = useState<number[]>([]);
  const [practiceMode, setPracticeMode] = useState(initialPracticeMode);
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentCharRef = useRef<HTMLSpanElement>(null);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLDivElement>(null);
  const caretBlinkTimeout = useRef<NodeJS.Timeout | null>(null);
  const pasteFlashTimeout = useRef<NodeJS.Timeout | null>(null);
  const [caretBlink, setCaretBlink] = useState(false);

  // Refs for accumulated stats across passages
  const accumulatedCorrectRef = useRef(0);
  const accumulatedIncorrectRef = useRef(0);
  const accumulatedTotalRef = useRef(0);

  const calculateAggregateStats = useCallback((overrideElapsedSeconds?: number) => {
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
    const elapsedSeconds = overrideElapsedSeconds ?? (isWordMode && startTime ? (Date.now() - startTime) / 1000 : currentDuration);
    const elapsedMinutes = Math.max(elapsedSeconds, 1) / 60;
    const wpm = Math.round(totalCorrect / 5 / elapsedMinutes);
    const rawWpm = Math.round(totalChars / 5 / elapsedMinutes);
    const accuracy = totalChars > 0 ? Math.round((totalCorrect / totalChars) * 100) : 0;

    return { wpm, rawWpm, accuracy, correctChars: totalCorrect, incorrectChars: totalIncorrect, totalChars };
  }, [typed, currentPassage, currentDuration, isWordMode, startTime]);

  const finishGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const completionTimeSeconds = startTime ? (Date.now() - startTime) / 1000 : 0;
    const stats = calculateAggregateStats(isWordMode ? completionTimeSeconds : undefined);
    const allPassageText = [
      ...completedPassages.map((p) => p.text),
      currentPassage,
    ].join(' | ');
    setResult({
      ...stats,
      duration: isWordMode ? Math.round(completionTimeSeconds) : currentDuration,
      passage: allPassageText,
      wpmSamples,
      gameMode: isWordMode ? 'words' : 'time',
      wordCount: isWordMode ? currentWordCount : undefined,
      completionTime: isWordMode ? Math.round(completionTimeSeconds * 10) / 10 : undefined,
      practiceMode,
    });
    setGameState('finished');
  }, [calculateAggregateStats, currentDuration, currentPassage, completedPassages, wpmSamples, startTime, isWordMode, currentWordCount, practiceMode]);

  const resetGame = useCallback((options?: { newPassage?: boolean; newDuration?: number; newWordCount?: number }) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const dur = options?.newDuration ?? currentDuration;
    if (options?.newDuration !== undefined) {
      setCurrentDuration(dur);
    }
    const wc = options?.newWordCount ?? currentWordCount;
    if (options?.newWordCount !== undefined) {
      setCurrentWordCount(wc);
    }
    if (isWordMode) {
      // Only regenerate word passage when explicitly requesting new text or when word count changes
      if (options?.newPassage || options?.newWordCount !== undefined) {
        setCurrentPassage(generateWordPassage(wc || 25));
      }
    } else if (options?.newPassage || options?.newDuration !== undefined) {
      setCurrentPassage(getRandomPassage(currentPassage));
    }
    setTyped('');
    setGameState('waiting');
    setTimeLeft(dur);
    setElapsedTime(0);
    setStartTime(null);
    setResult(null);
    setCompletedPassages([]);
    setWpmSamples([]);
    accumulatedCorrectRef.current = 0;
    accumulatedIncorrectRef.current = 0;
    accumulatedTotalRef.current = 0;
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [currentDuration, currentPassage, isWordMode, currentWordCount]);

  const startGame = useCallback(() => {
    setGameState('running');
    const now = Date.now();
    setStartTime(now);

    if (isWordMode) {
      // Count up timer for word mode, derived from wall-clock elapsed time
      setElapsedTime(0);
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - now) / 1000));
      }, 200);
    } else {
      // Countdown timer derived from wall-clock elapsed time to avoid drift
      setTimeLeft(currentDuration);
      timerRef.current = setInterval(() => {
        const elapsedSec = (Date.now() - now) / 1000;
        const remaining = Math.max(0, currentDuration - elapsedSec);
        // Round up so the displayed countdown only hits 0 once the real time has elapsed
        setTimeLeft(Math.ceil(remaining));
      }, 200);
    }
  }, [currentDuration, isWordMode]);

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

  // Handle timer reaching 0 (time mode only)
  useEffect(() => {
    if (!isWordMode && timeLeft === 0 && gameState === 'running') {
      finishGame();
    }
  }, [timeLeft, gameState, finishGame, isWordMode]);

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

  // Auto-scroll to current typing position & update caret position
  useEffect(() => {
    if (currentCharRef.current) {
      currentCharRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    // Update caret position. The caret is absolutely positioned inside the scrollable
    // container, so we need to compensate for the container's scroll offset to keep
    // the caret aligned with the current character when the text has scrolled.
    if (currentCharRef.current && textDisplayRef.current && caretRef.current) {
      const charRect = currentCharRef.current.getBoundingClientRect();
      const containerRect = textDisplayRef.current.getBoundingClientRect();
      const scrollTop = textDisplayRef.current.scrollTop;
      const scrollLeft = textDisplayRef.current.scrollLeft;
      caretRef.current.style.left = `${charRect.left - containerRect.left + scrollLeft}px`;
      caretRef.current.style.top = `${charRect.top - containerRect.top + scrollTop}px`;
      caretRef.current.style.height = `${charRect.height}px`;
    }
    // Reset blink: caret is solid while typing, blinks after 500ms pause
    setCaretBlink(false);
    if (caretBlinkTimeout.current) clearTimeout(caretBlinkTimeout.current);
    caretBlinkTimeout.current = setTimeout(() => {
      setCaretBlink(true);
    }, 500);
    return () => {
      if (caretBlinkTimeout.current) clearTimeout(caretBlinkTimeout.current);
    };
  }, [typed, currentPassage, completedPassages]);

  const handlePasteOrDrop = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement> | React.DragEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setPasteBlocked(true);
      if (pasteFlashTimeout.current) clearTimeout(pasteFlashTimeout.current);
      pasteFlashTimeout.current = setTimeout(() => setPasteBlocked(false), 1800);
    },
    []
  );

  // Cleanup paste flash timeout on unmount
  useEffect(() => {
    return () => {
      if (pasteFlashTimeout.current) clearTimeout(pasteFlashTimeout.current);
    };
  }, []);

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

    // If typed all characters of current passage, chain to next passage or finish (word mode)
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

      // In word mode, finishing the passage means the game is done
      if (isWordMode) {
        const completedTyped = value.slice(0, currentPassage.length);
        const completedText = currentPassage;
        setCompletedPassages((prev) => [...prev, { text: completedText, typed: completedTyped }]);
        setTyped('');
        if (inputRef.current) {
          inputRef.current.value = '';
        }
        // Use setTimeout to let state updates settle before finishing
        setTimeout(() => finishGame(), 0);
        return;
      }

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

  // Periodic tick to force WPM/accuracy recalculation even when user pauses typing
  const [, setTick] = useState(0);
  useEffect(() => {
    if (gameState !== 'running') return;
    const id = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, [gameState]);

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
      {/* Practice Mode Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={practiceMode}
            aria-label="Toggle practice mode"
            onClick={() => {
              if (gameState === 'waiting') {
                setPracticeMode((v) => !v);
              }
            }}
            disabled={gameState !== 'waiting'}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-neon-yellow/50 disabled:opacity-60 disabled:cursor-not-allowed ${
              practiceMode ? 'bg-neon-yellow/40 border border-neon-yellow/60' : 'bg-gray-800 border border-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                practiceMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <div className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-wider text-gray-400">Practice Mode</span>
            <span className="text-[10px] text-gray-500">
              {practiceMode ? 'Scores will NOT be saved' : 'Scores save to leaderboard'}
            </span>
          </div>
        </div>
        {practiceMode && (
          <div className="px-3 py-1 bg-neon-yellow/10 border border-neon-yellow/40 rounded-full text-neon-yellow text-xs font-semibold uppercase tracking-wider">
            Practice Mode
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-neon-blue">
              {isWordMode ? elapsedTime : timeLeft}
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">
              {isWordMode ? 'elapsed' : 'seconds'}
            </div>
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

        {/* Duration selector (time mode only) */}
        {!isWordMode && (
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
        )}
        {isWordMode && (
          <div className="flex items-center gap-2">
            {[10, 25, 50, 100].map((wc) => (
              <button
                key={wc}
                onClick={() => resetGame({ newWordCount: wc })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  currentWordCount === wc
                    ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                {wc}w
              </button>
            ))}
          </div>
        )}
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
              className = 'text-gray-300';
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

        {/* Smooth sliding caret */}
        <div
          ref={caretRef}
          className={`absolute w-0.5 bg-neon-blue rounded-full pointer-events-none transition-all duration-100 ease-out ${caretBlink ? 'caret-blink' : ''}`}
          style={{ left: 0, top: 0, height: '1.5em' }}
        />

        {/* Hidden Input */}
        <textarea
          ref={inputRef}
          value={typed}
          onChange={handleInput}
          onPaste={handlePasteOrDrop}
          onDrop={handlePasteOrDrop}
          onDragOver={(e) => e.preventDefault()}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text resize-none"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Type the displayed text here"
        />

        {/* Paste/drop blocked toast */}
        {pasteBlocked && (
          <div
            className="absolute top-2 right-2 bg-red-500/90 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg pointer-events-none animate-fade-in z-20"
            role="status"
            aria-live="polite"
          >
            Paste &amp; drop disabled — keyboard only
          </div>
        )}
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
