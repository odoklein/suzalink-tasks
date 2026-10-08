import "server-only";

import { db } from "@/lib/db";
import { decide, RATE_LIMITS, windowStart, type RateLimitPolicy, type RateLimitResult } from "@/lib/rate-limit-policy";
import { clientIp } from "@/lib/request-ip";

export { RATE_LIMITS, type RateLimitPolicy, type RateLimitResult };

/**
 * Compte une requête pour `policy` + `identifier` (IP, clé d'API…) avec un
 * upsert atomique, et dit si elle passe. En cas de panne de la base, on
 * laisse passer (l'authentification propre à chaque route reste en place).
 */
export async function rateLimit(policy: RateLimitPolicy, identifier: string | null): Promise<RateLimitResult> {
  const { limit, windowSec } = RATE_LIMITS[policy];
  const now = new Date();
  const key = `${policy}:${identifier ?? "inconnu"}`.slice(0, 300);
  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "windowStart", "count")
      VALUES (${key}, ${windowStart(now, windowSec)}, 1)
      ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimit"."count" + 1
      RETURNING "count"`;
    return decide(Number(rows[0]?.count ?? 1), limit, now, windowSec);
  } catch (error) {
    console.error("rate-limit", error);
    return { allowed: true, remaining: limit, retryAfterSec: 0, limit };
  }
}

/** Limite par IP depuis une Server Action ou un composant serveur (en-têtes de la requête en cours). */
export async function rateLimitCurrentIp(policy: RateLimitPolicy): Promise<RateLimitResult> {
  const { headers } = await import("next/headers");
  return rateLimit(policy, clientIp(await headers()));
}

/** Limite par IP depuis une route (Request standard). */
export function rateLimitRequest(policy: RateLimitPolicy, request: Request, suffix = ""): Promise<RateLimitResult> {
  return rateLimit(policy, `${clientIp(request.headers) ?? "inconnu"}${suffix ? `:${suffix}` : ""}`);
}

/** Réponse 429 standard (routes publiques). */
export function tooManyRequests(result: RateLimitResult, headers: HeadersInit = {}) {
  return Response.json(
    { error: "Trop de requêtes. Réessayez plus tard.", retryAfter: result.retryAfterSec },
    { status: 429, headers: { ...headers, "Retry-After": String(result.retryAfterSec) } },
  );
}

/** Supprime les fenêtres terminées depuis plus d'un jour (étape quotidienne). */
export async function purgeRateLimits() {
  await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
}
