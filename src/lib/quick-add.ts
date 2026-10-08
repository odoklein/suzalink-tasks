import type { Priority } from "@prisma/client";
import { addDays, nextDay, startOfDay, type Day } from "date-fns";

export type QuickAddResult = {
  title: string;
  assigneeId?: string;
  priority?: Priority;
  zone?: string;
  dueDate?: Date;
  billable: boolean;
  /** Montant estimé du hors périmètre (« $150 »), en centimes. */
  amountCents?: number;
  tokens: { kind: "assignee" | "priority" | "zone" | "due" | "billable"; label: string }[];
};

type Member = { id: string; name: string };

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const PRIORITY_WORDS: Record<string, Priority> = {
  urgent: "URGENT",
  urgente: "URGENT",
  "!!!": "URGENT",
  haute: "HIGH",
  haut: "HIGH",
  high: "HIGH",
  "!!": "HIGH",
  moyenne: "MEDIUM",
  moyen: "MEDIUM",
  basse: "LOW",
  bas: "LOW",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  URGENT: "Urgente",
  HIGH: "Haute",
  MEDIUM: "Moyenne",
  LOW: "Basse",
  NONE: "Aucune",
};

const WEEKDAYS: Record<string, Day> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

function parseDue(word: string, today: Date): Date | undefined {
  const w = normalize(word);
  if (w === "aujourd'hui" || w === "aujourdhui" || w === "auj") return today;
  if (w === "demain") return addDays(today, 1);
  if (w in WEEKDAYS) return nextDay(today, WEEKDAYS[w]);
  const plus = /^\+(\d{1,3})j$/.exec(w);
  if (plus) return addDays(today, Number(plus[1]));
  const dm = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(w);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]) - 1;
    let year = dm[3] ? Number(dm[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    const date = new Date(year, month, day);
    if (Number.isNaN(date.getTime()) || date.getDate() !== day) return undefined;
    // « 12/01 » saisi en décembre vise l'année suivante
    if (!dm[3] && date < addDays(today, -30)) date.setFullYear(year + 1);
    return date;
  }
  return undefined;
}

/**
 * Saisie rapide : « Retirer l'ombre @odo !haute #homepage demain $ »
 * @prénom → assigné · !urgent/!haute/!moyenne/!basse → priorité
 * #zone → page ou section · aujourd'hui, demain, lundi, 12/10, +3j → échéance
 * $ → hors périmètre (à facturer)
 */
export function parseQuickAdd(
  input: string,
  team: Member[],
  now = new Date(),
): QuickAddResult {
  const today = startOfDay(now);
  const result: QuickAddResult = { title: "", billable: false, tokens: [] };
  const kept: string[] = [];

  for (const word of input.trim().split(/\s+/)) {
    if (!word) continue;

    if (word.startsWith("@") && word.length > 1) {
      const wanted = normalize(word.slice(1));
      const member = team.find((m) => normalize(m.name).split(/\s+/)[0].startsWith(wanted));
      if (member) {
        result.assigneeId = member.id;
        result.tokens.push({ kind: "assignee", label: member.name.split(" ")[0] });
        continue;
      }
    }

    if (word.startsWith("!")) {
      const raw = word === "!!!" || word === "!!" ? word : normalize(word.slice(1));
      const priority = PRIORITY_WORDS[raw];
      if (priority) {
        result.priority = priority;
        result.tokens.push({ kind: "priority", label: PRIORITY_LABELS[priority] });
        continue;
      }
    }

    if (word.startsWith("#") && word.length > 1) {
      const zone = word.slice(1).replace(/[_-]+/g, " ");
      result.zone = zone.charAt(0).toUpperCase() + zone.slice(1);
      result.tokens.push({ kind: "zone", label: result.zone });
      continue;
    }

    // « $ » : hors périmètre ; « $150 » ou « $150,50 » : avec un montant estimé (P4-10).
    const money = /^\$(\d{1,6}(?:[.,]\d{1,2})?)?$/.exec(word);
    if (money) {
      result.billable = true;
      if (money[1]) result.amountCents = Math.round(Number(money[1].replace(",", ".")) * 100);
      result.tokens.push({
        kind: "billable",
        label: money[1] ? `Hors périmètre · ${money[1].replace(".", ",")} €` : "Hors périmètre",
      });
      continue;
    }

    const due = parseDue(word, today);
    if (due) {
      result.dueDate = due;
      result.tokens.push({
        kind: "due",
        label: due.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
      });
      continue;
    }

    kept.push(word);
  }

  result.title = kept.join(" ");
  return result;
}
