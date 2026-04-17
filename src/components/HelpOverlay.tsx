'use client';

import { useEffect, useRef } from 'react';

interface Shortcut {
  keys: string[];
  label: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Tab'], label: 'Restart the current test with the same settings' },
  { keys: ['Esc'], label: 'Load a new random passage (or exit custom text mode)' },
  { keys: ['Any key'], label: 'Start typing to begin the test (in the waiting state)' },
  { keys: ['?'], label: 'Open this keyboard shortcuts overlay from anywhere' },
  { keys: ['Ctrl', '/'], label: 'Open this keyboard shortcuts overlay (alternative)' },
  { keys: ['Esc'], label: 'Close this overlay when it is open' },
];

interface HelpOverlayProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Full-screen modal that lists every keyboard shortcut the typing
 * game supports. The overlay is:
 *   - Rendered via a fixed-position backdrop that captures clicks
 *     outside the dialog to dismiss.
 *   - Dismissable via the Escape key (handled here, not in the
 *     game's global shortcut listener — see TypingGame.tsx where
 *     we short-circuit Tab/Esc when `helpOpen` is true).
 *   - Styled to match the app's dark neon theme using the same
 *     gray-900 background and neon-blue accents as the rest of
 *     the UI.
 */
export function HelpOverlay({ open, onClose }: HelpOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    // Use capture so we intercept the Escape key before TypingGame's
    // own global listener handles it and resets the passage. React
    // state doesn't guarantee listener ordering, so capture phase is
    // the safest way to ensure the overlay's Escape handler wins when
    // it is open.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  // Focus the dialog on open so assistive tech announces it and so
  // the Escape key works without the user having to click inside
  // first.
  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-overlay-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-gray-900 border border-neon-blue/30 rounded-xl shadow-[0_0_40px_rgba(0,240,255,0.2)] p-6 md:p-8 focus:outline-none"
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2
              id="help-overlay-title"
              className="text-2xl font-bold"
            >
              <span className="text-neon-blue">Keyboard</span>{' '}
              <span className="text-gray-200">Shortcuts</span>
            </h2>
            <p className="text-gray-500 text-xs mt-1">
              Speed up your workflow with these keys.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts overlay"
            className="text-gray-500 hover:text-gray-200 transition-colors p-1 rounded hover:bg-gray-800"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <ul className="divide-y divide-gray-800">
          {SHORTCUTS.map((s, idx) => (
            <li
              key={`${s.keys.join('+')}-${idx}`}
              className="flex items-center justify-between gap-4 py-3"
            >
              <span className="text-sm text-gray-300 leading-snug">{s.label}</span>
              <span className="flex items-center gap-1 flex-shrink-0">
                {s.keys.map((k, i) => (
                  <span key={`${k}-${i}`} className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-200 text-xs font-mono">
                      {k}
                    </kbd>
                    {i < s.keys.length - 1 && (
                      <span className="text-gray-600 text-xs">+</span>
                    )}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 text-xs text-gray-600 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400">Esc</kbd> or click outside to close.
        </div>
      </div>
    </div>
  );
}
