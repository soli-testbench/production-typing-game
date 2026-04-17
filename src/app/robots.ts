import type { MetadataRoute } from 'next';

function getBaseUrl(): string {
  const fromEnv = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://typeracer-pro.fly.dev';
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/game', '/leaderboard', '/stats'],
        // Keep crawlers out of API and internal Next.js paths.
        disallow: ['/api/', '/_next/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
