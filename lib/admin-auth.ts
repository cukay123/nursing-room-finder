/**
 * Admin session tokens.
 *
 * A deliberately small scheme: the operator sets ADMIN_PASSWORD, and a successful
 * login mints a cookie holding an expiry plus an HMAC of that expiry keyed by the
 * password. Nothing is stored server-side, so it works on any host without a
 * session store.
 *
 * This is single-operator protection, not user accounts. When the app needs real
 * per-user admin identities, replace this with Supabase Auth and an allowlist —
 * `isAuthorized` and the proxy matcher are the only call sites to change.
 *
 * Uses Web Crypto so it runs in the Edge runtime that proxy.ts executes in.
 */

export const SESSION_COOKIE = 'nrf_admin_session';

/** How long a login stays valid. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const encoder = new TextEncoder();

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));

  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Length-independent comparison, so a mismatch leaks no timing information. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function createSessionToken(secret: string): Promise<string> {
  const expiry = String(Date.now() + SESSION_TTL_MS);
  return `${expiry}.${await sign(expiry, secret)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string
): Promise<boolean> {
  if (!token) return false;

  const [expiry, signature] = token.split('.');
  if (!expiry || !signature) return false;

  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return timingSafeEqual(signature, await sign(expiry, secret));
}

export async function verifyPassword(
  candidate: string,
  secret: string
): Promise<boolean> {
  // Compare digests rather than the raw strings so the comparison is
  // fixed-length regardless of what was submitted.
  const [a, b] = await Promise.all([
    sign(candidate, 'password-check'),
    sign(secret, 'password-check'),
  ]);
  return timingSafeEqual(a, b);
}
