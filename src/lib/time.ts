import { TZDate, tz } from "@date-fns/tz";
import { endOfDay, format, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

/** Fuseau de l'équipe : les dates affichées et saisies sont toujours en heure de Paris. */
export const TZ = "Europe/Paris";

type DateInput = Date | string | number;

const inParis = { in: tz(TZ) };
const plain = (date: Date) => new Date(date.getTime());

/** L'instant présent, exprimé en heure de Paris (les getters donnent l'heure murale de Paris). */
export function nowParis(): TZDate {
  return TZDate.tz(TZ);
}

/** Minuit à Paris du jour (parisien) contenant `d`, en instant UTC. */
export function startOfDayParis(d: DateInput = Date.now()): Date {
  return plain(startOfDay(d, inParis));
}

/** 23 h 59 min 59,999 s à Paris du jour (parisien) contenant `d`, en instant UTC. */
export function endOfDayParis(d: DateInput = Date.now()): Date {
  return plain(endOfDay(d, inParis));
}

/** `yyyy-MM-dd`, pour un `<input type="date">`. */
export function toParisDateInput(d: DateInput): string {
  return format(d, "yyyy-MM-dd", inParis);
}

/** `yyyy-MM-ddTHH:mm`, pour un `<input type="datetime-local">`. */
export function toParisDateTimeInput(d: DateInput): string {
  return format(d, "yyyy-MM-dd'T'HH:mm", inParis);
}

/** Lit un `datetime-local` (`yyyy-MM-ddTHH:mm`) saisi à l'heure de Paris ; renvoie l'instant UTC. */
export function fromParisDateTimeInput(s: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s.trim());
  if (!match) return new Date(NaN);
  const [year, month, day, hour, minute, second] = match.slice(1).map((v) => Number(v ?? 0));
  return plain(new TZDate(year, month - 1, day, hour, minute, second, TZ));
}

/** Lit un `<input type="date">` (`yyyy-MM-dd`) : minuit à Paris, en instant UTC. `Invalid Date` si le format est faux. */
export function fromParisDateInput(s: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? fromParisDateTimeInput(`${s.trim()}T00:00`) : new Date(NaN);
}

/** `format` de date-fns en heure de Paris, avec les noms de jours et de mois en français. */
export function formatParis(d: DateInput, pattern: string): string {
  return format(d, pattern, { in: tz(TZ), locale: fr });
}
