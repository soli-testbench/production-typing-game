import type { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/url';

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
