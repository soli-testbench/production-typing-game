import type { MetadataRoute } from 'next';

/**
 * Resolve the canonical base URL used in the sitemap. We prefer the
 * `SITE_URL` env var (settable per-environment), fall back to Vercel's
 * built-in `VERCEL_URL`, and finally default to the production domain.
 * Each fallback is wrapped in a try so mis-configured envs never crash
 * the build.
 */
function getBaseUrl(): string {
  const fromEnv = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://typeracer-pro.fly.dev';
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  const lastModified = new Date();
  const staticPaths: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/game', priority: 0.9, changeFrequency: 'weekly' },
    { path: '/leaderboard', priority: 0.8, changeFrequency: 'hourly' },
    { path: '/stats', priority: 0.7, changeFrequency: 'daily' },
  ];

  return staticPaths.map(({ path, priority, changeFrequency }) => ({
    url: `${baseUrl}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
