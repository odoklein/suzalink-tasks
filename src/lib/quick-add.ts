import type { Priority } from "@prisma/client";
import { TZDate, tz } from "@date-fns/tz";
import { addDays, nextDay, type Day } from "date-fns";

import { formatParis, startOfDayParis, TZ } from "./time";

export type QuickAddResult = {
  title: string;
  assigneeId?: string;
  priority?: Priority;
  zone?: string;
  dueDate?: Date;
  billable: boolean;
  /** Montant estimé du hors périmètre (« $150 »), en centimes. */
  amountCents?: number;
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

const inParis = { in: tz(TZ) };
const plain = (date: Date) => new Date(date.getTime());

/** `today` est minuit à Paris ; toutes les dates produites sont des minuits parisiens (en instants UTC). */
export function parseDue(word: string, today: Date): Date | undefined {
  const w = normalize(word);
  if (w === "aujourd'hui" || w === "aujourdhui" || w === "auj") return today;
  if (w === "demain") return plain(addDays(today, 1, inParis));
  if (w in WEEKDAYS) return plain(nextDay(today, WEEKDAYS[w], inParis));
  const plus = /^\+(\d{1,3})j$/.exec(w);
  if (plus) return plain(addDays(today, Number(plus[1]), inParis));
  const dm = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(w);
  if (dm) {
    const day = Number(dm[1]);
    const month = Number(dm[2]) - 1;
    let year = dm[3] ? Number(dm[3]) : new TZDate(today, TZ).getFullYear();
    if (year < 100) year += 2000;
    const date = new TZDate(year, month, day, TZ);
    if (Number.isNaN(date.getTime()) || date.getDate() !== day || date.getMonth() !== month) return undefined;
    // « 12/01 » saisi en décembre vise l'année suivante
    if (!dm[3] && date.getTime() < addDays(today, -30, inParis).getTime()) {
      return plain(new TZDate(year + 1, month, day, TZ));
    }
    return plain(date);
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
  // `now` est un instant (ou un TZDate de nowParis()) : « aujourd'hui » est le jour calendaire à Paris,
  // quel que soit le fuseau de la machine (le serveur tourne en UTC).
  const today = startOfDayParis(now);
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
        label: formatParis(due, "EEE d MMM"),
      });
      continue;
    }

    kept.push(word);
  }

  result.title = kept.join(" ");
  return result;
}
