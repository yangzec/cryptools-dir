import { authenticateAdmin, requirePermission } from '@/server/admin/auth';
import { AdminError } from '@/server/admin/types';

import { envConfigs } from '@/config';
import { saveConfigs } from '@/modules/config/service';
import {
  DATAANY_CALLBACK_PATH,
  DATAANY_STATE_COOKIE,
  dataanyOrigin,
  isConnectState,
  isWebsiteId,
  normalizeConnectDomain,
} from '@/lib/dataany-connect';
import { locales, localizeHref } from '@/paraglide/runtime.js';

const SETTINGS_PATH = '/admin/settings?tab=analytics';
const STATE_TTL_SECONDS = 600;

// 32 bytes from the CSPRNG, base64url (43 chars).
function randomState() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** One of the app's locales, or undefined (= the default). */
function pickLocale(value: string | null | undefined) {
  return (locales as readonly string[]).includes(value || '')
    ? (value as (typeof locales)[number])
    : undefined;
}

/**
 * The analytics settings page in the admin's language. DataAny's approval
 * page uses its own default language; the admin's locale rides along in the
 * state cookie so the round trip lands back on e.g. /zh/admin/settings.
 */
function settingsUrl(locale?: string, outcome?: string) {
  const path = outcome ? `${SETTINGS_PATH}&dataany=${outcome}` : SETTINGS_PATH;
  const picked = pickLocale(locale);
  return picked ? localizeHref(path, { locale: picked }) : path;
}

/** Cookie value `<state>.<locale>`; state is base64url, so it has no dot. */
function parseStateCookie(value: string | null) {
  const [state, locale] = (value || '').split('.');
  return { state: state || null, locale: pickLocale(locale) };
}

function appOrigin() {
  return new URL(envConfigs.app_url).origin;
}

function stateCookie(value: string, maxAge: number) {
  const secure = appOrigin().startsWith('https:') ? '; Secure' : '';
  // Lax: the cookie must come back on DataAny's top-level redirect.
  return `${DATAANY_STATE_COOKIE}=${value}; Path=${DATAANY_CALLBACK_PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

function readCookie(request: Request, name: string) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

function redirect(location: string, cookie?: string) {
  const headers = new Headers({
    Location: location,
    'Cache-Control': 'no-store',
  });
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

async function requireSettingsWriter(request: Request) {
  const actor = await authenticateAdmin(request);
  requirePermission(actor, 'settings.write');
}

function errorResponse(error: unknown, locale?: string) {
  if (error instanceof AdminError && error.status === 401) {
    const signIn = `/sign-in?callbackUrl=${encodeURIComponent(SETTINGS_PATH)}`;
    const picked = pickLocale(locale);
    return redirect(picked ? localizeHref(signIn, { locale: picked }) : signIn);
  }
  if (error instanceof AdminError)
    return new Response(error.message, { status: error.status });
  return redirect(settingsUrl(locale, 'error'));
}

/** GET /api/admin/dataany/connect: off to DataAny to approve this site. */
export async function startDataanyConnect(request: Request) {
  const locale = pickLocale(new URL(request.url).searchParams.get('locale'));
  try {
    await requireSettingsWriter(request);
    const origin = appOrigin();
    const domain = normalizeConnectDomain(new URL(origin).hostname);
    if (!domain) throw new Error('VITE_APP_URL has no usable hostname');
    const state = randomState();
    const url = new URL('/connect', dataanyOrigin(envConfigs.dataany_url));
    url.searchParams.set('domain', domain);
    url.searchParams.set('redirect_uri', `${origin}${DATAANY_CALLBACK_PATH}`);
    url.searchParams.set('state', state);
    return redirect(
      url.toString(),
      stateCookie(locale ? `${state}.${locale}` : state, STATE_TTL_SECONDS)
    );
  } catch (error) {
    return errorResponse(error, locale);
  }
}

/** GET /api/admin/dataany/callback: DataAny sends the browser back here. */
export async function finishDataanyConnect(request: Request) {
  const clear = stateCookie('', 0);
  const expected = parseStateCookie(readCookie(request, DATAANY_STATE_COOKIE));
  const locale = expected.locale;
  try {
    await requireSettingsWriter(request);
    const params = new URL(request.url).searchParams;
    const state = params.get('state');
    // A callback that didn't start here (or a replay) carries no matching
    // state; never save its website id.
    if (!isConnectState(state) || state !== expected.state)
      return redirect(settingsUrl(locale, 'error'), clear);
    if (params.get('error') === 'access_denied')
      return redirect(settingsUrl(locale, 'denied'), clear);
    const websiteId = params.get('website_id');
    if (!isWebsiteId(websiteId))
      return redirect(settingsUrl(locale, 'error'), clear);
    await saveConfigs({
      dataany_connect_method: 'oauth',
      dataany_website_id: websiteId!,
    });
    return redirect(settingsUrl(locale, 'connected'), clear);
  } catch (error) {
    const response = errorResponse(error, locale);
    response.headers.append('Set-Cookie', clear);
    return response;
  }
}
