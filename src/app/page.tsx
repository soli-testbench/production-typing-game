import Link from 'next/link';

const gameModes = [
  {
    title: '15 Seconds',
    description: 'Quick burst test. Perfect for a fast warm-up.',
    duration: 15,
    color: 'text-neon-green',
    borderColor: 'border-neon-green/30',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(57,255,20,0.2)]',
    icon: '⚡',
  },
  {
    title: '30 Seconds',
    description: 'Short and sweet. Great for quick practice sessions.',
    duration: 30,
    color: 'text-neon-blue',
    borderColor: 'border-neon-blue/30',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(0,240,255,0.2)]',
    icon: '🚀',
  },
  {
    title: '60 Seconds',
    description: 'The classic test. Standard duration for measuring WPM.',
    duration: 60,
    color: 'text-neon-purple',
    borderColor: 'border-neon-purple/30',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(191,0,255,0.2)]',
    icon: '🎯',
  },
  {
    title: '120 Seconds',
    description: 'Endurance mode. Test your consistency over time.',
    duration: 120,
    color: 'text-neon-pink',
    borderColor: 'border-neon-pink/30',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(255,0,110,0.2)]',
    icon: '🏆',
  },
];

const wordModes = [
  {
    title: '10 Words',
    description: 'Lightning round. Type 10 words as fast as you can.',
    wordCount: 10,
    color: 'text-neon-green',
    borderColor: 'border-neon-green/30',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(57,255,20,0.2)]',
    icon: '💨',
  },
  {
    title: '25 Words',
    description: 'Quick challenge. A short burst of words.',
    wordCount: 25,
    color: 'text-neon-blue',
    borderColor: 'border-neon-blue/30',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(0,240,255,0.2)]',
    icon: '✏️',
  },
  {
    title: '50 Words',
    description: 'Balanced test. Enough words for a solid measurement.',
    wordCount: 50,
    color: 'text-neon-purple',
    borderColor: 'border-neon-purple/30',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(191,0,255,0.2)]',
    icon: '📝',
  },
  {
    title: '100 Words',
    description: 'Full challenge. Test your endurance and consistency.',
    wordCount: 100,
    color: 'text-neon-pink',
    borderColor: 'border-neon-pink/30',
    hoverGlow: 'hover:shadow-[0_0_30px_rgba(255,0,110,0.2)]',
    icon: '📖',
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col items-center animate-fade-in">
      {/* Hero Section */}
      <div className="text-center mb-16 mt-8">
        <h1 className="text-5xl md:text-7xl font-bold mb-4">
          <span className="text-neon-blue animate-pulse-glow inline-block">Type</span>
          <span className="text-neon-purple animate-pulse-glow inline-block">Racer</span>
          <span className="text-neon-pink animate-pulse-glow inline-block ml-2">Pro</span>
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mt-4">
          Test your typing speed. Compete on the leaderboard. Become the fastest typist.
        </p>
        <div className="flex items-center justify-center gap-2 mt-6 text-gray-500 text-sm">
          <span className="inline-block w-2 h-2 rounded-full bg-neon-green animate-pulse" />
          <span>Real-time WPM tracking</span>
          <span className="mx-2">•</span>
          <span>Character-by-character feedback</span>
          <span className="mx-2">•</span>
          <span>Global leaderboard</span>
        </div>
      </div>

      {/* Game Mode Cards */}
      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-semibold text-gray-300 mb-6 text-center">
          Select Game Mode
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {gameModes.map((mode) => (
            <Link
              key={mode.duration}
              href={`/game?duration=${mode.duration}`}
              className={`card-hover block bg-gray-900/80 border ${mode.borderColor} rounded-xl p-6 text-center group ${mode.hoverGlow} transition-all duration-300`}
            >
              <div className="text-4xl mb-3">{mode.icon}</div>
              <h3 className={`text-xl font-bold ${mode.color} mb-2`}>
                {mode.title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {mode.description}
              </p>
              <div className={`mt-4 text-sm ${mode.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
                Start Test →
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Word Count Mode Cards */}
      <div className="w-full max-w-4xl mt-12">
        <h2 className="text-2xl font-semibold text-gray-300 mb-6 text-center">
          Word Count
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {wordModes.map((mode) => (
            <Link
              key={mode.wordCount}
              href={`/game?mode=words&wordCount=${mode.wordCount}`}
              className={`card-hover block bg-gray-900/80 border ${mode.borderColor} rounded-xl p-6 text-center group ${mode.hoverGlow} transition-all duration-300`}
            >
              <div className="text-4xl mb-3">{mode.icon}</div>
              <h3 className={`text-xl font-bold ${mode.color} mb-2`}>
                {mode.title}
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                {mode.description}
              </p>
              <div className={`mt-4 text-sm ${mode.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
                Start Test →
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Stats / CTA */}
      <div className="mt-16 text-center">
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-neon-blue transition-colors duration-200 text-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          View Leaderboard
        </Link>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="mt-12 text-gray-600 text-xs text-center">
        <p>
          <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 text-xs">Tab</kbd> to restart test •{' '}
          <kbd className="px-2 py-1 bg-gray-800 rounded text-gray-400 text-xs">Esc</kbd> to reset
        </p>
      </div>
    </div>
  );
}
