import { envConfigs } from '@/config';

function originOf(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Whether a cookie-authenticated write came from this site's own pages.
 *
 * `request.url` alone is not enough: behind a reverse proxy, Docker, or a
 * platform router the server often sees `http://localhost:3000` or plain
 * `http://<host>` while the browser sends `Origin: https://<host>`. So the
 * browser's Origin is also accepted when it is the configured site URL
 * (VITE_APP_URL / AUTH_URL) or listed in AUTH_TRUSTED_ORIGINS. These are the
 * same origins better-auth trusts for sign-in. Forwarded headers are never
 * used, because whoever sends the request controls them.
 */
export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;

  const allowed = [request.url, envConfigs.app_url, envConfigs.auth_url]
    .map(originOf)
    .filter(Boolean);
  if (allowed.includes(origin)) return true;

  // AUTH_TRUSTED_ORIGINS: comma-separated; entries starting with a dot are
  // hostname-suffix wildcards (same rules as src/core/auth/index.ts).
  const extra = (process.env.AUTH_TRUSTED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (extra.some((rule) => !rule.startsWith('.') && originOf(rule) === origin))
    return true;

  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  return extra.some(
    (rule) =>
      rule.startsWith('.') && (host === rule.slice(1) || host.endsWith(rule))
  );
}
