/**
 * `plural(1, "tâche")` → « 1 tâche », `plural(3, "tâche")` → « 3 tâches ».
 * En français, 0 et 1 (et les décimaux < 2) restent au singulier.
 * Irrégulier : `plural(2, "travail", "travaux")`.
 */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${Math.abs(n) >= 2 ? pluralForm : singular}`;
}
