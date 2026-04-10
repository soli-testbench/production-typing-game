import type { Metadata } from 'next';
import { Fira_Code } from 'next/font/google';
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { PlayerProvider } from '@/components/PlayerProvider';

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-fira-code',
});

export const metadata: Metadata = {
  title: 'TypeRacer Pro - Typing Speed Test',
  description: 'Test and improve your typing speed with TypeRacer Pro. Multiple game modes, real-time WPM tracking, and global leaderboards.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'TypeRacer Pro - Typing Speed Test',
    description: 'Test and improve your typing speed with TypeRacer Pro. Multiple game modes, real-time WPM tracking, and global leaderboards.',
    type: 'website',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'TypeRacer Pro - Typing Speed Test',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TypeRacer Pro - Typing Speed Test',
    description: 'Test and improve your typing speed with TypeRacer Pro. Multiple game modes, real-time WPM tracking, and global leaderboards.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={firaCode.variable}>
      <body className={`${firaCode.className} min-h-screen bg-gray-950 text-gray-100 font-mono antialiased`}>
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
