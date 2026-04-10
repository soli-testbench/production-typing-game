'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { usePlayer } from '@/components/PlayerProvider';
import { NameEntryModal } from '@/components/NameEntryModal';

export function Navigation() {
  const pathname = usePathname();
  const { playerName } = usePlayer();
  const [showNameModal, setShowNameModal] = useState(false);

  const linkClass = (path: string) =>
    `transition-colors duration-200 px-3 py-2 rounded-lg text-sm font-medium ${
      pathname === path
        ? 'text-neon-blue bg-gray-800/50'
        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
    }`;

  return (
    <>
      <nav className="border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between h-14">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-lg font-bold">
                <span className="text-neon-blue">Type</span>
                <span className="text-neon-purple">Racer</span>
              </span>
            </Link>

            <div className="flex items-center gap-1">
              <Link href="/" className={linkClass('/')}>
                Home
              </Link>
              <Link href="/game?duration=60" className={linkClass('/game')}>
                Play
              </Link>
              <Link href="/leaderboard" className={linkClass('/leaderboard')}>
                Leaderboard
              </Link>
            </div>

            <button
              onClick={() => setShowNameModal(true)}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden sm:inline">{playerName || 'Set Name'}</span>
            </button>
          </div>
        </div>
      </nav>

      {showNameModal && (
        <NameEntryModal onClose={() => setShowNameModal(false)} />
      )}
    </>
  );
}
