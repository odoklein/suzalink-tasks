import { parseDue } from "@/lib/quick-add";

/** Date sans heure au format `yyyy-MM-dd` (celui d’un <input type="date">). */
export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (y: number, m: number, d: number): ISODate => `${y}-${pad(m)}-${pad(d)}`;

export function parseISODate(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return { y, m, d };
}

/** Ajoute des jours à une date ISO (arithmétique UTC : pas de piège d’heure d’été). */
export function addDaysISO(value: ISODate, days: number): ISODate {
  const parts = parseISODate(value);
  if (!parts) return value;
  const date = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + days));
  return toISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Jour de la semaine, lundi = 0 … dimanche = 6. */
export function weekdayMonday0(value: ISODate): number {
  const parts = parseISODate(value);
  if (!parts) return 0;
  return (new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay() + 6) % 7;
}

/** Raccourcis proposés : Aujourd’hui, Demain, Lundi (prochain), +1 sem, Aucune. */
export function quickPicks(today: ISODate): { label: string; value: ISODate | null }[] {
  const nextMonday = addDaysISO(today, 7 - weekdayMonday0(today));
  return [
    { label: "Aujourd’hui", value: today },
    { label: "Demain", value: addDaysISO(today, 1) },
    { label: "Lundi", value: nextMonday },
    { label: "+1 sem", value: addDaysISO(today, 7) },
    { label: "Aucune", value: null },
  ];
}

export type GridDay = { value: ISODate; day: number; inMonth: boolean };

/** Semaines (lundi en premier) couvrant le mois `month` (1 à 12), jours voisins inclus. */
export function monthGrid(year: number, month: number): GridDay[][] {
  const first = toISO(year, month, 1);
  const start = addDaysISO(first, -weekdayMonday0(first));
  const weeks: GridDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: GridDay[] = [];
    for (let i = 0; i < 7; i++) {
      const value = addDaysISO(start, w * 7 + i);
      const parts = parseISODate(value)!;
      week.push({ value, day: parts.d, inMonth: parts.m === month });
    }
    if (w >= 4 && !week.some((day) => day.inMonth)) break;
    weeks.push(week);
  }
  return weeks;
}

/**
 * Lit ce que la personne tape : syntaxe de la saisie rapide (demain, lundi, +3j, 12/10,
 * 12/10/2026) ou date ISO. Renvoie `null` pour un champ vide (= aucune date) et `undefined`
 * si le texte n’est pas une date.
 */
export function parseDateInput(text: string, today: ISODate): ISODate | null | undefined {
  const value = text.trim();
  if (!value) return null;
  if (parseISODate(value)) return value;
  const parts = parseISODate(today);
  if (!parts) return undefined;
  const date = parseDue(value, new Date(parts.y, parts.m - 1, parts.d));
  return date ? toISO(date.getFullYear(), date.getMonth() + 1, date.getDate()) : undefined;
}
