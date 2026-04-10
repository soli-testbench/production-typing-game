'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { TypingGame } from '@/components/TypingGame';

function GameContent() {
  const searchParams = useSearchParams();
  const durationParam = searchParams.get('duration');
  const duration = [15, 30, 60, 120].includes(Number(durationParam))
    ? Number(durationParam)
    : 60;

  return <TypingGame duration={duration} />;
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="text-center text-gray-500 mt-20">Loading...</div>}>
      <GameContent />
    </Suspense>
  );
}
