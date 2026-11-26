import { envConfigs } from '@/config';

/**
 * An outbound link tagged with this site as the traffic source
 * (utm_source = our hostname), so the other side's analytics can credit it.
 * Existing utm_ parameters on the link are left alone.
 */
export function withUtmSource(
  link: string,
  extra: Record<string, string> = {}
): string {
  try {
    const url = new URL(link);
    if (![...url.searchParams.keys()].some((key) => key.startsWith('utm_'))) {
      url.searchParams.set('utm_source', appHostname());
      for (const [key, value] of Object.entries(extra))
        url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    return link;
  }
}

function appHostname() {
  if (typeof window !== 'undefined' && window.location.hostname)
    return window.location.hostname.replace(/^www\./, '');
  try {
    return new URL(envConfigs.app_url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
