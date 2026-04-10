'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';

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

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playerName, setPlayerNameState] = useState('');
  const [anonymousId, setAnonymousId] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const storedName = localStorage.getItem('playerName') || '';
    let storedId = localStorage.getItem('anonymousId');
    if (!storedId) {
      storedId = uuidv4();
      localStorage.setItem('anonymousId', storedId);
    }
    setPlayerNameState(storedName);
    setAnonymousId(storedId);
    setIsNameSet(!!storedName);
  }, []);

  const setPlayerName = useCallback((name: string) => {
    const sanitized = name.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 20).trim();
    setPlayerNameState(sanitized);
    localStorage.setItem('playerName', sanitized);
    setIsNameSet(!!sanitized);
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
