import type { Metadata } from 'next';
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { PlayerProvider } from '@/components/PlayerProvider';

export const metadata: Metadata = {
  title: 'TypeRacer Pro - Typing Speed Test',
  description: 'Test and improve your typing speed with TypeRacer Pro. Multiple game modes, real-time WPM tracking, and global leaderboards.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 font-mono antialiased">
        <PlayerProvider>
          <Navigation />
          <main className="container mx-auto px-4 py-8 max-w-6xl">
            {children}
          </main>
        </PlayerProvider>
      </body>
    </html>
  );
}
