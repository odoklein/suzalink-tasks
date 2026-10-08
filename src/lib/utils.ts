import { clsx, type ClassValue } from "clsx";
import { tz } from "@date-fns/tz";
import { differenceInCalendarDays, formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";

import { formatParis, TZ } from "@/lib/time";

const inParis = { in: tz(TZ) };

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** « BIERES GEORGES » → « BG », « Crésus Paie » → « CP ». */
export function projectKey(name: string) {
  const words = slugify(name).split("-").filter(Boolean);
  const key =
    words.length > 1
      ? words.map((word) => word[0]).join("")
      : (words[0] ?? "P").slice(0, 3);
  return key.slice(0, 4).toUpperCase();
}

/** « Aujourd'hui », « Demain », « Hier », « lun. 12 oct. » */
export function formatDue(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  // Jours calendaires à Paris (le serveur tourne en UTC).
  const days = differenceInCalendarDays(value, new Date(), inParis);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  if (days === -1) return "Hier";
  return formatParis(value, "EEE d MMM");
}

export function dueTone(date: Date | string | null, done = false) {
  if (!date || done) return "muted" as const;
  const days = differenceInCalendarDays(typeof date === "string" ? new Date(date) : date, new Date(), inParis);
  if (days < 0) return "overdue" as const;
  if (days <= 1) return "soon" as const;
  return "muted" as const;
}

/** « 8 oct. 2026 à 14h30 », toujours en heure de Paris (identique sur le serveur et dans le navigateur). */
export function formatDateTime(date: Date | string) {
  return formatParis(date, "d MMM yyyy 'à' HH'h'mm");
}

export function formatShortDate(date: Date | string) {
  return formatParis(date, "dd/MM");
}

export function timeAgo(date: Date | string) {
  return formatDistanceToNowStrict(typeof date === "string" ? new Date(date) : date, {
    locale: fr,
    addSuffix: true,
  });
}
