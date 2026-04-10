import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
      <div className="max-w-md w-full text-center">
        <div className="text-8xl font-bold mb-4">
          <span className="text-neon-purple">4</span>
          <span className="text-neon-blue">0</span>
          <span className="text-neon-pink">4</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-200 mb-3">Page Not Found</h2>
        <p className="text-gray-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 bg-neon-blue/20 text-neon-blue border border-neon-blue/30 rounded-lg hover:bg-neon-blue/30 transition-colors font-medium"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
