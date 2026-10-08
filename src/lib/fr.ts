/** Typographie française pour les textes affichés. */

/** Espace fine insécable : avant « : ; ! ? % » et à l’intérieur des guillemets. */
export const NNBSP = "\u202f";
/** Espace insécable ordinaire. */
export const NBSP = "\u00a0";

/** « texte », avec les espaces fines insécables. */
export function quote(text: string) {
  return `«${NNBSP}${text}${NNBSP}»`;
}

/**
 * Remplace l’espace ordinaire avant « : ; ! ? » par une espace fine insécable.
 * Une URL (« https:// ») n’est pas touchée : pas d’espace avant ses « : ».
 */
export function nbspPunctuation(text: string) {
  return text.replace(/ ([:;!?])/g, `${NNBSP}$1`);
}

const percentFormat = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

/** 0,42 → « 42 % », avec une espace fine insécable avant « % ». */
export function formatPercent(ratio: number) {
  // Selon la version d'ICU, Intl met une espace insécable ordinaire : on la normalise en espace fine.
  return percentFormat.format(Number.isFinite(ratio) ? ratio : 0).replace(/[\u00a0 ]%/, `${NNBSP}%`);
}

/** « jeudi 8 octobre » → « Jeudi 8 octobre » : seule la première lettre passe en majuscule. */
export function capitalizeFirst(text: string) {
  return text.charAt(0).toLocaleUpperCase("fr-FR") + text.slice(1);
}

/** « Odo », « Odo ou Hichem », « Odo, Hichem ou Amine ». */
export function joinOr(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} ou ${items.at(-1)}`;
}
