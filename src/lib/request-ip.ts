/**
 * Adresse IP du client derrière l'hébergeur. Netlify fournit
 * `x-nf-client-connection-ip` (non falsifiable par le client) ; ailleurs on
 * prend la première adresse de `x-forwarded-for` (Vercel l'écrase côté edge).
 */
export function clientIp(headers: Pick<Headers, "get">): string | null {
  const netlify = headers.get("x-nf-client-connection-ip")?.trim();
  if (netlify) return netlify;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || null;
}
