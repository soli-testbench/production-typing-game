'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeName } from '@/lib/sanitize-name';

interface PlayerContextType {
  playerName: string;
  anonymousId: string;
  setPlayerName: (name: string) => void;
  isNameSet: boolean;
  resetIdentity: () => void;
}

const PlayerContext = createContext<PlayerContextType>({
  playerName: '',
  anonymousId: '',
  setPlayerName: () => {},
  isNameSet: false,
  resetIdentity: () => {},
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

  // Clears the stored identity (anonymousId + playerName) from localStorage
  // and generates a fresh anonymousId in memory so subsequent requests (and
  // the next page load) act as a brand-new player. Used by the "Delete My
  // Data" flow after a successful server-side deletion.
  const resetIdentity = useCallback(() => {
    if (storageAvailableRef.current) {
      try {
        localStorage.removeItem('anonymousId');
      } catch {
        console.warn('Failed to remove anonymousId from localStorage');
      }
      try {
        localStorage.removeItem('playerName');
      } catch {
        console.warn('Failed to remove playerName from localStorage');
      }
    }
    const newId = uuidv4();
    if (storageAvailableRef.current) {
      try {
        localStorage.setItem('anonymousId', newId);
      } catch {
        console.warn('Failed to persist new anonymousId to localStorage');
      }
    }
    setAnonymousId(newId);
    setPlayerNameState('');
    setIsNameSet(false);
  }, []);

  if (!mounted) {
    return (
      <PlayerContext.Provider value={{ playerName: '', anonymousId: '', setPlayerName, isNameSet: false, resetIdentity }}>
        {children}
      </PlayerContext.Provider>
    );
  }

  return (
    <PlayerContext.Provider value={{ playerName, anonymousId, setPlayerName, isNameSet, resetIdentity }}>
      {children}
    </PlayerContext.Provider>
  );
}
