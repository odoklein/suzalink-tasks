import { createHash } from "node:crypto";

/**
 * Clé de déduplication d'une ligne de retours (P4-03) :
 * `sha1(normalize(page) + "|" + normalize(retour))`.
 *
 * `normalize` met en minuscules, retire les accents et toute ponctuation
 * (« l'ombre » = « l’ombre » = « L ombre ») et réduit les espaces. Une même
 * ligne recollée plus tard, même avec une casse ou une ponctuation différente,
 * retombe donc sur la même clé. Module Node uniquement (serveur et scripts).
 */
export function normalizeKeyPart(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function importKey(zone: string | null | undefined, retour: string): string {
  return createHash("sha1").update(`${normalizeKeyPart(zone)}|${normalizeKeyPart(retour)}`).digest("hex");
}
