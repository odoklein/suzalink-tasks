import type { Priority } from "@prisma/client";
import { addDays, nextDay, startOfDay, type Day } from "date-fns";

export type QuickAddResult = {
  title: string;
  assigneeId?: string;
  priority?: Priority;
  zone?: string;
  dueDate?: Date;
  billable: boolean;
  tokens: QuickAddToken[];
};

type Member = { id: string; name: string };

/**
 * `ambiguous` : un @prénom qui correspond à plusieurs membres. Le mot reste dans le titre,
 * personne n'est attribué, et `candidates` (ordre alphabétique) alimente l'aide à la saisie.
 */
export type QuickAddToken = {
  kind: "assignee" | "priority" | "zone" | "due" | "billable" | "ambiguous";
  label: string;
  candidates?: Member[];
};

const NNBSP = "\u202f";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type MemberMatch =
  | { kind: "none" }
  | { kind: "one"; member: Member }
  | { kind: "many"; candidates: Member[] };

/**
 * Prénom exact d'abord, puis préfixe unique. Un préfixe qui désigne plusieurs
 * personnes est ambigu : le résultat ne dépend jamais de l'ordre de `team`.
 */
function matchMember(team: Member[], wanted: string): MemberMatch {
  const first = (member: Member) => normalize(member.name).split(/\s+/)[0];
  const exact = team.filter((member) => first(member) === wanted);
  const found = exact.length > 0 ? exact : team.filter((member) => first(member).startsWith(wanted));
  if (found.length === 0) return { kind: "none" };
  if (found.length === 1) return { kind: "one", member: found[0] };
  return { kind: "many", candidates: [...found].sort((a, b) => a.name.localeCompare(b.name, "fr")) };
}

/** « @an : Anaïs ou Antoine ? » (espaces fines insécables avant « : » et « ? »). */
function ambiguousLabel(word: string, candidates: Member[]) {
  const firstNames = candidates.map((member) => member.name.split(" ")[0]);
  const list = firstNames.length > 1 ? `${firstNames.slice(0, -1).join(", ")} ou ${firstNames.at(-1)}` : firstNames[0];
  return `${word}${NNBSP}: ${list}${NNBSP}?`;
}

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
 * @prénom → attribuée à (prénom exact, sinon préfixe unique ; ambigu : on n'attribue pas) · !urgent/!haute/!moyenne/!basse → priorité
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
      const match = matchMember(team, wanted);
      if (match.kind === "one") {
        result.assigneeId = match.member.id;
        result.tokens.push({ kind: "assignee", label: match.member.name.split(" ")[0] });
        continue;
      }
      if (match.kind === "many") {
        result.tokens.push({ kind: "ambiguous", label: ambiguousLabel(word, match.candidates), candidates: match.candidates });
        kept.push(word);
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

    if (word === "$") {
      result.billable = true;
      result.tokens.push({ kind: "billable", label: "Hors périmètre" });
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
