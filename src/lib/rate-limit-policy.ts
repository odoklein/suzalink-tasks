/** Politiques de limitation (fenêtre fixe). Pur : testable sans base. */
export const RATE_LIMITS = {
  login: { limit: 20, windowSec: 15 * 60 },
  portal: { limit: 120, windowSec: 60 },
  portalWrite: { limit: 20, windowSec: 10 * 60 },
  widget: { limit: 20, windowSec: 60 },
  webhook: { limit: 240, windowSec: 60 },
  api: { limit: 120, windowSec: 60 },
  ai: { limit: 30, windowSec: 60 * 60 },
} as const satisfies Record<string, { limit: number; windowSec: number }>;

export type RateLimitPolicy = keyof typeof RATE_LIMITS;

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSec: number; limit: number };

/** Début de la fenêtre contenant `now`. */
export function windowStart(now: Date, windowSec: number): Date {
  const size = windowSec * 1000;
  return new Date(Math.floor(now.getTime() / size) * size);
}

/** Décision à partir du compteur après incrément. */
export function decide(count: number, limit: number, now: Date, windowSec: number): RateLimitResult {
  const end = windowStart(now, windowSec).getTime() + windowSec * 1000;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSec: count <= limit ? 0 : Math.max(1, Math.ceil((end - now.getTime()) / 1000)),
    limit,
  };
}
