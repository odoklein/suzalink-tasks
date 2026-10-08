/**
 * Nombre suivi du nom accordé, règle française (0 et 1 au singulier) :
 * `plural(1, "tâche")` → « 1 tâche », `plural(3, "tâche")` → « 3 tâches ».
 * Pluriel irrégulier en second argument : `plural(2, "retour importé", "retours importés")`.
 */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${Math.abs(n) >= 2 ? pluralForm : singular}`;
}
