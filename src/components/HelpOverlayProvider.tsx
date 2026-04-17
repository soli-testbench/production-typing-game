'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { HelpOverlay } from '@/components/HelpOverlay';

interface HelpOverlayContextValue {
  open: boolean;
  openOverlay: () => void;
  closeOverlay: () => void;
  toggleOverlay: () => void;
}

const HelpOverlayContext = createContext<HelpOverlayContextValue | null>(null);

/**
 * Provides a single, app-wide keyboard-shortcut help overlay that can
 * be opened from the Navigation bar (`?` button) or via global
 * keyboard shortcut (`?` key when not typing, or `Ctrl+/` from
 * anywhere). The TypingGame component reads this context so it can
 * suppress its own Tab/Escape handlers while the overlay is open.
 */
export function HelpOverlayProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openOverlay = useCallback(() => setOpen(true), []);
  const closeOverlay = useCallback(() => setOpen(false), []);
  const toggleOverlay = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when the user is focused in a text input / textarea /
      // contenteditable — typing `?` into a form field should still
      // insert a literal question mark. Ctrl+/ is safe to intercept
      // anywhere because it has no default behavior in text inputs.
      const target = e.target as HTMLElement | null;
      const isTextInput =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleOverlay();
        return;
      }
      if (!isTextInput && e.key === '?') {
        e.preventDefault();
        toggleOverlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleOverlay]);

  const value = useMemo(
    () => ({ open, openOverlay, closeOverlay, toggleOverlay }),
    [open, openOverlay, closeOverlay, toggleOverlay]
  );

  return (
    <HelpOverlayContext.Provider value={value}>
      {children}
      <HelpOverlay open={open} onClose={closeOverlay} />
    </HelpOverlayContext.Provider>
  );
}

export function useHelpOverlay(): HelpOverlayContextValue {
  const ctx = useContext(HelpOverlayContext);
  if (!ctx) {
    // Intentionally return a no-op implementation rather than throwing
    // so unit tests / stories that render components outside the
    // provider don't crash. In production the provider is mounted at
    // the root layout so ctx is always defined.
    return {
      open: false,
      openOverlay: () => undefined,
      closeOverlay: () => undefined,
      toggleOverlay: () => undefined,
    };
  }
  return ctx;
}
