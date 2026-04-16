import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Global Leaderboard | TypeRacer Pro',
  description:
    'See the fastest typists on TypeRacer Pro. Browse the global leaderboard of top WPM scores across every game mode, and track how your personal best stacks up against the best.',
  openGraph: {
    title: 'Global Leaderboard | TypeRacer Pro',
    description:
      'See the fastest typists on TypeRacer Pro. Browse the global leaderboard of top WPM scores across every game mode.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Global Leaderboard | TypeRacer Pro',
    description:
      'See the fastest typists on TypeRacer Pro. Browse the global leaderboard of top WPM scores across every game mode.',
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
