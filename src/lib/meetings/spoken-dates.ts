import { TZDate, tz } from "@date-fns/tz";
import { addDays, nextDay, type Day } from "date-fns";

import { parseDue } from "@/lib/quick-add";
import { startOfDayParis, TZ } from "@/lib/time";

/**
 * Échéance dite pendant une réunion (« demain », « d'ici jeudi », « le 12 octobre »)
 * → minuit à Paris, par rapport au jour de la réunion. Module pur et prudent :
 * tout ce qui est ambigu (« la semaine prochaine », « mardi prochain », « bientôt »)
 * reste null, et le texte dit est montré tel quel au manager.
 */

const inParis = { in: tz(TZ) };
const plain = (date: Date) => new Date(date.getTime());

const WEEKDAYS: Record<string, Day> = { dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6 };
const MONTHS: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
};

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export function resolveSpokenDue(spoken: string | null | undefined, meetingStartsAt: Date): Date | null {
  if (!spoken) return null;
  const text = normalize(spoken);
  const today = startOfDayParis(meetingStartsAt);

  // « mardi prochain », « la semaine prochaine », « fin du mois » : on ne devine pas.
  if (/\b(prochaine?s?|bientot|rapidement|semaine|mois|fin|debut|courant|asap|des que)\b/.test(text)) return null;

  if (/\bapres[- ]demain\b/.test(text)) return plain(addDays(today, 2, inParis));
  if (/\bdemain\b/.test(text)) return plain(addDays(today, 1, inParis));
  if (/\b(aujourd'?hui|ce soir|tout a l'heure)\b/.test(text)) return today;

  // « le 12 octobre », « 3 novembre 2026 »
  const named = /\b(\d{1,2})(?:er)? (janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)(?: (\d{4}))?\b/.exec(text);
  if (named) {
    const day = Number(named[1]);
    const month = MONTHS[named[2]];
    const explicitYear = named[3] ? Number(named[3]) : null;
    let year = explicitYear ?? new TZDate(today, TZ).getFullYear();
    let date = new TZDate(year, month, day, TZ);
    if (date.getDate() !== day) return null;
    if (!explicitYear && date.getTime() < today.getTime()) {
      year += 1;
      date = new TZDate(year, month, day, TZ);
    }
    return plain(date);
  }

  // « le 12/10 »
  const numeric = /\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/.exec(text);
  if (numeric) return parseDue(numeric[1], today) ?? null;

  // « jeudi », « d'ici jeudi », « avant vendredi » : le prochain jour de ce nom.
  const weekdays = Object.keys(WEEKDAYS).filter((name) => new RegExp(`\\b${name}\\b`).test(text));
  if (weekdays.length === 1) return plain(nextDay(today, WEEKDAYS[weekdays[0]], inParis));

  return null;
}
