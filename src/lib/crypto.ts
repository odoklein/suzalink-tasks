import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Comparaison à temps constant de deux chaînes (secrets, signatures). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // On compare quand même pour ne pas révéler la longueur par le temps de réponse.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/** Vérifie un en-tête `Authorization: Bearer <secret>`. */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return !!match && safeEqual(match[1], secret);
}

export const sha256Hex = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export const hmacHex = (algorithm: "sha1" | "sha256", secret: string, body: string | Buffer) =>
  createHmac(algorithm, secret).update(body).digest("hex");

/** Jeton aléatoire URL-safe (liens magiques, agenda, clés d'API). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
