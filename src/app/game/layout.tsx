import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Play Typing Test | TypeRacer Pro',
  description:
    'Take a typing speed test. Pick from 15/30/60/120-second time trials, fixed word-count sprints (10/25/50/100 words), or paste your own passage in custom mode. Real-time WPM, accuracy, and per-character error feedback.',
  openGraph: {
    title: 'Play Typing Test | TypeRacer Pro',
    description:
      'Take a typing speed test with real-time WPM and accuracy tracking. Multiple modes including time trials, word sprints, and custom text.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Play Typing Test | TypeRacer Pro',
    description:
      'Take a typing speed test with real-time WPM and accuracy tracking. Multiple modes including time trials, word sprints, and custom text.',
  },
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
