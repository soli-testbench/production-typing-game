'use client';

import { useState, useRef, useEffect } from 'react';
import { usePlayer } from '@/components/PlayerProvider';

interface NameEntryModalProps {
  onClose: () => void;
  onSaved?: () => void;
}

export function NameEntryModal({ onClose, onSaved }: NameEntryModalProps) {
  const { playerName, setPlayerName } = usePlayer();
  const [name, setName] = useState(playerName);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const validate = (value: string): string => {
    if (!value.trim()) return 'Name is required';
    if (value.trim().length > 20) return 'Name must be 20 characters or fewer';
    if (!/^[a-zA-Z0-9 ]+$/.test(value.trim())) return 'Only letters, numbers, and spaces allowed';
    return '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    setPlayerName(name.trim());
    onSaved?.();
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    if (error) setError(validate(value));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4 animate-slide-up">
        <h2 className="text-xl font-bold text-gray-100 mb-2">Enter Your Name</h2>
        <p className="text-gray-400 text-sm mb-6">
          Choose a display name for the leaderboard.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={handleChange}
            placeholder="Your display name"
            maxLength={20}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className={`w-full bg-gray-800 border ${
              error ? 'border-red-500' : 'border-gray-600'
            } rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-neon-blue transition-colors`}
          />
          {error && (
            <p className="text-red-400 text-sm mt-2">{error}</p>
          )}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-gray-400 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 text-gray-900 bg-neon-blue rounded-lg hover:bg-neon-blue/90 font-semibold transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
