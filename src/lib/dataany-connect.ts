/**
 * "Connect DataAny" handshake, shared by both sides:
 *
 * - The site's admin (/api/admin/dataany/connect) sends the browser to
 *   `<DATAANY_URL>/connect?domain=…&redirect_uri=…&state=…`.
 * - DataAny (/connect) has its signed-in user approve, finds or creates the
 *   site for that domain, and sends the browser back to redirect_uri with
 *   `state` and `website_id` (or `error`).
 * - The callback checks `state` against the cookie it set, then saves the
 *   website id.
 *
 * A website id is public (it sits in every page's HTML), so there is no
 * token exchange. `state` stops a forged callback from planting someone
 * else's id, and redirect_uri must live on the domain being connected.
 */

export const DATAANY_DEFAULT_URL = 'https://dataany.ai';
export const DATAANY_CALLBACK_PATH = '/api/admin/dataany/callback';
export const DATAANY_STATE_COOKIE = 'dataany_connect_state';

const STATE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const WEBSITE_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;
const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function isLocalHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/** Lowercase hostname without `www.`; null when it isn't a public hostname or localhost. */
export function normalizeConnectDomain(input: string | null | undefined) {
  const value = (input || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '');
  if (isLocalHost(value) || HOSTNAME_PATTERN.test(value)) return value;
  return null;
}

/**
 * The DataAny origin (scheme + host), from a configured value. https only,
 * except localhost for development; anything else falls back to dataany.ai.
 */
export function dataanyOrigin(configured: string | null | undefined) {
  try {
    const url = new URL((configured || '').trim() || DATAANY_DEFAULT_URL);
    if (
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && isLocalHost(url.hostname))
    )
      return url.origin;
  } catch {}
  return DATAANY_DEFAULT_URL;
}

export interface ConnectRequest {
  domain: string;
  redirectUri: string;
  state: string;
}

/**
 * Validates an incoming /connect request. redirect_uri must be https (http
 * only for localhost), carry no credentials or fragment, and sit on the
 * domain being connected (www. ignored), so a site can only ask for itself.
 */
export function parseConnectRequest(input: {
  domain?: string | null;
  redirect_uri?: string | null;
  state?: string | null;
}): ConnectRequest | null {
  const domain = normalizeConnectDomain(input.domain);
  const state = input.state || '';
  if (!domain || !STATE_PATTERN.test(state)) return null;
  let url: URL;
  try {
    url = new URL(input.redirect_uri || '');
  } catch {
    return null;
  }
  const local = isLocalHost(url.hostname);
  if (
    !(url.protocol === 'https:' || (url.protocol === 'http:' && local)) ||
    url.username ||
    url.password ||
    url.hash ||
    url.hostname.replace(/^www\./, '') !== domain
  )
    return null;
  return { domain, redirectUri: url.toString(), state };
}

/** Where /connect sends the browser back to, with the outcome. */
export function connectReturnUrl(
  request: ConnectRequest,
  result: { websiteId: string } | { error: 'access_denied' | 'server_error' }
) {
  const url = new URL(request.redirectUri);
  url.searchParams.set('state', request.state);
  if ('websiteId' in result)
    url.searchParams.set('website_id', result.websiteId);
  else url.searchParams.set('error', result.error);
  return url.toString();
}

export function isConnectState(value: string | null | undefined) {
  return !!value && STATE_PATTERN.test(value);
}

export function isWebsiteId(value: string | null | undefined) {
  return !!value && WEBSITE_ID_PATTERN.test(value);
}
