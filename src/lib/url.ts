/**
 * Resolve the canonical base URL used in metadata (JSON-LD, robots.txt,
 * sitemap.xml, etc.). We prefer the `SITE_URL` env var (settable per
 * environment), fall back to the public `NEXT_PUBLIC_SITE_URL`, then to
 * Vercel's built-in `VERCEL_URL`, and finally to the production domain.
 *
 * This function is the single source of truth for the base URL — all
 * consumers (home page JSON-LD, robots.ts, sitemap.ts) import from here
 * so there is exactly one place to update when the canonical host
 * changes.
 */
export function getBaseUrl(): string {
  const fromEnv = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://typeracer-pro.fly.dev';
}
