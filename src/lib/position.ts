const STEP = 1000;

/** Position d'une tâche insérée entre `prev` et `next` (voisins dans la colonne, s'ils existent). */
export function computePosition(prev?: number, next?: number): number {
  if (prev !== undefined && next !== undefined) return (prev + next) / 2;
  if (prev !== undefined) return prev + STEP;
  if (next !== undefined) return next - STEP;
  return STEP;
}
