/**
 * Fixed-window, per-key rate limiting held in process memory.
 *
 * Scope, so it isn't mistaken for more than it is: the counter lives in one
 * server instance's memory. Scale to several instances and each gets its own
 * allowance; restart and the window resets. That is fine for holding back casual
 * spam against a public form, which is what it is used for here, but a determined
 * flood or a multi-instance deployment wants a shared store (Postgres, Upstash)
 * instead.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Bound the map so a flood of unique keys cannot grow it without limit. */
const MAX_TRACKED_KEYS = 10_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets. */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || now >= existing.resetAt) {
    if (windows.size >= MAX_TRACKED_KEYS) {
      // Cheapest useful eviction: drop whatever has already expired, and if
      // nothing has, drop the oldest insertion.
      for (const [k, w] of windows) {
        if (now >= w.resetAt) windows.delete(k);
      }
      if (windows.size >= MAX_TRACKED_KEYS) {
        const oldest = windows.keys().next().value;
        if (oldest !== undefined) windows.delete(oldest);
      }
    }

    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;

  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfter };
  }

  return { allowed: true, remaining: limit - existing.count, retryAfter };
}

/**
 * Best-effort client identity.
 *
 * These headers are trivially spoofed unless a trusted proxy sets them, so this
 * raises the cost of casual abuse rather than providing a guarantee.
 */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return req.headers.get('x-real-ip') || 'unknown';
}
