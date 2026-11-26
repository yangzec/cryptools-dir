/**
 * Helpers for GET /api/storage/download — keep free of route/auth imports
 * so unit tests stay light.
 */

function isIpv4Private(hostname: string): boolean {
  const dotted = normalizeIpv4Literal(hostname);
  if (!dotted) return false;
  const parts = dotted.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    // CGNAT
    (parts[0] === 100 && parts[1]! >= 64 && parts[1]! <= 127)
  );
}

/**
 * Accept dotted, short (127.1 → 127.0.0.1), decimal (2130706433),
 * hex (0x7f000001), and octal-ish forms so hostname-only SSRF checks
 * cannot be bypassed.
 */
export function normalizeIpv4Literal(input: string): string | null {
  const raw = input
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '');
  if (!raw) return null;

  // Pure decimal / hex integer form of an IPv4 address
  if (/^(0x[0-9a-f]+|\d+)$/i.test(raw) && !raw.includes('.')) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return null;
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(
      '.'
    );
  }

  const parts = raw.split('.');
  if (parts.length < 1 || parts.length > 4) return null;

  const nums: number[] = [];
  for (const part of parts) {
    if (!/^(0x[0-9a-f]+|[0-9]+)$/i.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0) return null;
    nums.push(n);
  }

  // inet_aton short forms: a.b → a.(b>>16).(b>>8&255).(b&255), etc.
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;
  if (nums.length === 1) {
    if (nums[0]! > 0xffffffff) return null;
    a = (nums[0]! >>> 24) & 255;
    b = (nums[0]! >>> 16) & 255;
    c = (nums[0]! >>> 8) & 255;
    d = nums[0]! & 255;
  } else if (nums.length === 2) {
    if (nums[0]! > 255 || nums[1]! > 0xffffff) return null;
    a = nums[0]!;
    b = (nums[1]! >>> 16) & 255;
    c = (nums[1]! >>> 8) & 255;
    d = nums[1]! & 255;
  } else if (nums.length === 3) {
    if (nums[0]! > 255 || nums[1]! > 255 || nums[2]! > 0xffff) return null;
    a = nums[0]!;
    b = nums[1]!;
    c = (nums[2]! >>> 8) & 255;
    d = nums[2]! & 255;
  } else {
    if (nums.some((n) => n > 255)) return null;
    a = nums[0]!;
    b = nums[1]!;
    c = nums[2]!;
    d = nums[3]!;
  }
  return `${a}.${b}.${c}.${d}`;
}

function stripHostBrackets(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '');
}

/**
 * Node URL often rewrites ::ffff:127.0.0.1 → ::ffff:7f00:1. Accept both
 * dotted and hex-hextet IPv4-mapped forms, including expanded 0:0:…:ffff:….
 */
function ipv4FromMappedIpv6(host: string): string | null {
  const h = stripHostBrackets(host);
  const dotted = h.match(/(?:^|:)ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (dotted?.[1]) return normalizeIpv4Literal(dotted[1]);
  const hex = h.match(/(?:^|:)ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hex) return null;
  const hi = parseInt(hex[1]!, 16);
  const lo = parseInt(hex[2]!, 16);
  if (!Number.isFinite(hi) || !Number.isFinite(lo)) return null;
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

/** Prefer URL parser normalization so padded / expanded forms collapse. */
function normalizeIpv6Literal(hostname: string): string | null {
  const host = stripHostBrackets(hostname);
  if (!host.includes(':')) return null;
  try {
    return stripHostBrackets(new URL(`http://[${host}]`).hostname);
  } catch {
    return host;
  }
}

function isIpv6Private(hostname: string): boolean {
  const host = stripHostBrackets(hostname);
  // Domain names must not match IPv6 prefix heuristics (e.g. fdshop.com).
  if (!host.includes(':')) return false;

  const mapped = ipv4FromMappedIpv6(host);
  if (mapped) return isIpv4Private(mapped);

  const normalized = normalizeIpv6Literal(host) || host;
  const mappedNorm = ipv4FromMappedIpv6(normalized);
  if (mappedNorm) return isIpv4Private(mappedNorm);

  if (
    normalized === '::1' ||
    normalized === '::' ||
    normalized === '0:0:0:0:0:0:0:1' ||
    normalized === '0:0:0:0:0:0:0:0'
  ) {
    return true;
  }

  // Unique-local fc00::/7 and link-local fe80::/10 via first hextet.
  const firstRaw = normalized.startsWith('::')
    ? '0'
    : normalized.split(':')[0] || '';
  if (!/^[0-9a-f]+$/i.test(firstRaw)) return false;
  const first = parseInt(firstRaw, 16);
  if (!Number.isFinite(first)) return false;
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  return false;
}

/** Reject loopback / private / link-local hosts (SSRF guard). */
export function isBlockedDownloadHost(hostname: string): boolean {
  const host = stripHostBrackets(hostname);
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }
  // DNS-rebinding helpers that commonly map to arbitrary IPs
  if (/\.(nip\.io|sslip\.io|xip\.io)$/i.test(host)) return true;
  if (isIpv4Private(host) || isIpv6Private(host)) return true;
  return false;
}

/**
 * Public http(s) CDNs are allowed (R2 / provider / mock), but never private
 * or special-use hosts. Callers must also use redirect:'manual' and re-check
 * Location targets.
 */
export function isAllowedDownloadSource(target: URL): boolean {
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return false;
  return !isBlockedDownloadHost(target.hostname);
}
