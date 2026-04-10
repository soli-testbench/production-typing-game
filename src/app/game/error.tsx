'use client';

import { useEffect } from 'react';

export default function GameError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Game error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">⌨️</div>
        <h2 className="text-2xl font-bold text-gray-200 mb-3">Game Error</h2>
        <p className="text-gray-400 mb-8">
          Something went wrong during the typing test. Your progress may have been lost.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-neon-green/20 text-neon-green border border-neon-green/30 rounded-lg hover:bg-neon-green/30 transition-colors font-medium"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-6 py-2.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            Go Home
          </a>
        </div>
      </div>
    </div>
  );
}
