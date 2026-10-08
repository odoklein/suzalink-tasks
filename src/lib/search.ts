const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Score d’un texte pour une requête : 3 = commence par la requête, 2 = un mot commence par
 * elle, 1 = la contient, 0 sinon. Accents et casse ignorés.
 */
export function matchScore(query: string, text: string | null | undefined): number {
  if (!text) return 0;
  const q = normalize(query.trim());
  const t = normalize(text);
  if (!q) return 0;
  if (t.startsWith(q)) return 3;
  if (t.split(/[\s\-_/'’.,:;()«»]+/).some((word) => word.startsWith(q))) return 2;
  return t.includes(q) ? 1 : 0;
}

/** Trie (stable) par meilleur score sur les champs donnés ; le premier champ pèse double. */
export function rankSearchResults<T>(query: string, items: T[], fields: (item: T) => (string | null | undefined)[]): T[] {
  const scored = items.map((item, index) => {
    const values = fields(item);
    const score = values.reduce((best, value, i) => Math.max(best, matchScore(query, value) * (i === 0 ? 2 : 1)), 0);
    return { item, index, score };
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((entry) => entry.item);
}
