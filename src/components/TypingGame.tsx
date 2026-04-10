'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { passages } from '@/data/passages';
import { ResultsScreen } from '@/components/ResultsScreen';

interface TypingGameProps {
  duration: number;
}

type GameState = 'waiting' | 'running' | 'finished';

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

function getRandomPassage(exclude?: string): string {
  const available = exclude ? passages.filter((p) => p !== exclude) : passages;
  return available[Math.floor(Math.random() * available.length)];
}

export function TypingGame({ duration }: TypingGameProps) {
  const [passage, setPassage] = useState(() => getRandomPassage());
  const [typed, setTyped] = useState('');
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [timeLeft, setTimeLeft] = useState(duration);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [currentDuration, setCurrentDuration] = useState(duration);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const calculateStats = useCallback(() => {
    let correct = 0;
    let incorrect = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === passage[i]) {
        correct++;
      } else {
        incorrect++;
      }
    }
    const totalChars = typed.length;
    const elapsedMinutes = currentDuration / 60;
    const wpm = Math.round(correct / 5 / elapsedMinutes);
    const rawWpm = Math.round(totalChars / 5 / elapsedMinutes);
    const accuracy = totalChars > 0 ? Math.round((correct / totalChars) * 100) : 0;

    return { wpm, rawWpm, accuracy, correctChars: correct, incorrectChars: incorrect, totalChars };
  }, [typed, passage, currentDuration]);

  const finishGame = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const stats = calculateStats();
    setResult({
      ...stats,
      duration: currentDuration,
      passage,
    });
    setGameState('finished');
  }, [calculateStats, currentDuration, passage]);

  const resetGame = useCallback((newPassage?: boolean) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (newPassage) {
      setPassage(getRandomPassage(passage));
    }
    setTyped('');
    setGameState('waiting');
    setTimeLeft(currentDuration);
    setStartTime(null);
    setResult(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [currentDuration, passage]);

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
      setCurrentDuration(duration);
      if (timerRef.current) clearInterval(timerRef.current);
      setTyped('');
      setGameState('waiting');
      setTimeLeft(duration);
      setStartTime(null);
      setResult(null);
      setPassage(getRandomPassage());
    }
  }, [duration, currentDuration]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        resetGame(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        resetGame(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetGame]);

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [gameState]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (gameState === 'finished') return;

    const value = e.target.value;

    if (gameState === 'waiting' && value.length > 0) {
      startGame();
    }

    // Don't allow typing beyond passage length
    if (value.length <= passage.length) {
      setTyped(value);
    }

    // Finish if typed all characters
    if (value.length >= passage.length) {
      finishGame();
    }
  };

  // Calculate live WPM
  const liveWpm = (() => {
    if (!startTime || gameState !== 'running') return 0;
    const elapsed = (Date.now() - startTime) / 1000 / 60;
    if (elapsed < 0.01) return 0;
    let correct = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === passage[i]) correct++;
    }
    return Math.round(correct / 5 / elapsed);
  })();

  const liveAccuracy = (() => {
    if (typed.length === 0) return 100;
    let correct = 0;
    for (let i = 0; i < typed.length; i++) {
      if (typed[i] === passage[i]) correct++;
    }
    return Math.round((correct / typed.length) * 100);
  })();

  if (result && gameState === 'finished') {
    return (
      <ResultsScreen
        result={result}
        onRetry={() => resetGame(false)}
        onNewTest={() => resetGame(true)}
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
              onClick={() => {
                setCurrentDuration(d);
                if (timerRef.current) clearInterval(timerRef.current);
                setTyped('');
                setGameState('waiting');
                setTimeLeft(d);
                setStartTime(null);
                setResult(null);
                setPassage(getRandomPassage());
              }}
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
        className="relative bg-gray-900/50 border border-gray-800 rounded-xl p-6 md:p-8 cursor-text min-h-48"
        onClick={() => inputRef.current?.focus()}
      >
        {gameState === 'waiting' && typed.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <p className="text-gray-500 text-lg">Click here or start typing to begin...</p>
          </div>
        )}

        {/* Text Display */}
        <div className="text-lg md:text-xl leading-relaxed tracking-wide select-none" aria-hidden="true">
          {passage.split('').map((char, index) => {
            let className = 'text-gray-600';
            if (index < typed.length) {
              className = typed[index] === char
                ? 'text-neon-green'
                : 'text-red-500 bg-red-500/10';
            } else if (index === typed.length) {
              className = 'text-gray-300 border-l-2 border-neon-blue cursor-blink';
            }
            return (
              <span key={index} className={className}>
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

      {/* Progress Bar */}
      <div className="mt-4 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-neon-blue to-neon-purple transition-all duration-100"
          style={{ width: `${(typed.length / passage.length) * 100}%` }}
        />
      </div>

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
