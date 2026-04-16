'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeName } from '@/lib/sanitize-name';

interface PlayerContextType {
  playerName: string;
  anonymousId: string;
  setPlayerName: (name: string) => void;
  isNameSet: boolean;
}

const PlayerContext = createContext<PlayerContextType>({
  playerName: '',
  anonymousId: '',
  setPlayerName: () => {},
  isNameSet: false,
});

export function usePlayer() {
  return useContext(PlayerContext);
}

function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playerName, setPlayerNameState] = useState('');
  const [anonymousId, setAnonymousId] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [mounted, setMounted] = useState(false);
  const storageAvailableRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    const storageAvailable = isLocalStorageAvailable();
    storageAvailableRef.current = storageAvailable;

    if (!storageAvailable) {
      console.warn(
        'localStorage is unavailable. Player data will not persist across page reloads. ' +
        'This may be caused by private browsing mode, storage quota exceeded, or browser policy.'
      );
    }

    let storedName = '';
    let storedId = '';

    if (storageAvailable) {
      try {
        storedName = localStorage.getItem('playerName') || '';
      } catch {
        console.warn('Failed to read playerName from localStorage');
      }
      try {
        storedId = localStorage.getItem('anonymousId') || '';
      } catch {
        console.warn('Failed to read anonymousId from localStorage');
      }
    }

    if (!storedId) {
      storedId = uuidv4();
      if (storageAvailable) {
        try {
          localStorage.setItem('anonymousId', storedId);
        } catch {
          console.warn('Failed to persist anonymousId to localStorage');
        }
      }
    }

    setPlayerNameState(storedName);
    setAnonymousId(storedId);
    setIsNameSet(!!storedName);
  }, []);

  const setPlayerName = useCallback((name: string) => {
    const sanitized = sanitizeName(name);
    setPlayerNameState(sanitized);
    setIsNameSet(!!sanitized);

    if (storageAvailableRef.current) {
      try {
        localStorage.setItem('playerName', sanitized);
      } catch {
        console.warn('Failed to persist playerName to localStorage');
      }
    }
  }, []);

  if (!mounted) {
    return (
      <PlayerContext.Provider value={{ playerName: '', anonymousId: '', setPlayerName, isNameSet: false }}>
        {children}
      </PlayerContext.Provider>
    );
  }

  return (
    <PlayerContext.Provider value={{ playerName, anonymousId, setPlayerName, isNameSet }}>
      {children}
    </PlayerContext.Provider>
  );
}
