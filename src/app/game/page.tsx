'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { TypingGame } from '@/components/TypingGame';

function GameContent() {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const durationParam = searchParams.get('duration');
  const wordCountParam = searchParams.get('wordCount');
  const practiceParam = searchParams.get('practice');
  const initialPracticeMode = practiceParam === 'true' || practiceParam === '1';

  if (modeParam === 'words') {
    const wordCount = [10, 25, 50, 100].includes(Number(wordCountParam))
      ? Number(wordCountParam)
      : 25;
    return (
      <TypingGame
        mode="words"
        wordCount={wordCount}
        duration={0}
        initialPracticeMode={initialPracticeMode}
      />
    );
  }

  const duration = [15, 30, 60, 120].includes(Number(durationParam))
    ? Number(durationParam)
    : 60;

  return (
    <TypingGame
      mode="time"
      duration={duration}
      initialPracticeMode={initialPracticeMode}
    />
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-500 mt-20">Loading...</div>}>
      <GameContent />
    </Suspense>
  );
}
