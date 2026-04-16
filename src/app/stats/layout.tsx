import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Typing Stats | TypeRacer Pro',
  description:
    'Review your personal typing performance on TypeRacer Pro: best WPM, average accuracy, total tests completed, and per-mode history. See how your speed and consistency improve over time.',
  openGraph: {
    title: 'Your Typing Stats | TypeRacer Pro',
    description:
      'Review your personal typing performance: best WPM, accuracy trends, and per-mode history on TypeRacer Pro.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Your Typing Stats | TypeRacer Pro',
    description:
      'Review your personal typing performance: best WPM, accuracy trends, and per-mode history on TypeRacer Pro.',
  },
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
