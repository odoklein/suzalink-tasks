/** Limites de saisie, vérifiées côté serveur (et reprises en `maxLength` dans les champs). */
export const TITLE_MAX = 180;
export const DESCRIPTION_MAX = 5000;

/**
 * Lien saisi (site du projet, mise en ligne) : vide → `null` ; adresse http(s) valide → l’adresse
 * normalisée ; sinon `undefined` (à refuser).
 */
export function parseHttpUrl(value: unknown): string | null | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Préfixe de projet : 1 à 4 lettres ou chiffres, en majuscules. Vide → `null` ; invalide → `undefined`. */
export function parseProjectKey(value: unknown): string | null | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  return /^[A-Za-z0-9]{1,4}$/.test(text) ? text.toUpperCase() : undefined;
}

/** `yyyy-MM-dd` d’un champ date, refusé avant l’an 2000 (année tapée à moitié : « 0202 »). */
export function isPlausibleDateInput(value: string) {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(value);
  return match !== null && Number(match[1]) >= 2000;
}
