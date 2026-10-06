import { clsx, type ClassValue } from "clsx";
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isToday,
  isTomorrow,
  isYesterday,
} from "date-fns";
import { fr } from "date-fns/locale";

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
  if (isToday(value)) return "Aujourd'hui";
  if (isTomorrow(value)) return "Demain";
  if (isYesterday(value)) return "Hier";
  return format(value, "EEE d MMM", { locale: fr });
}

export function dueTone(date: Date | string | null, done = false) {
  if (!date || done) return "muted" as const;
  const days = differenceInCalendarDays(
    typeof date === "string" ? new Date(date) : date,
    new Date(),
  );
  if (days < 0) return "overdue" as const;
  if (days <= 1) return "soon" as const;
  return "muted" as const;
}

export function formatDateTime(date: Date | string) {
  return format(typeof date === "string" ? new Date(date) : date, "d MMM yyyy 'à' HH'h'mm", {
    locale: fr,
  });
}

export function formatShortDate(date: Date | string) {
  return format(typeof date === "string" ? new Date(date) : date, "dd/MM", { locale: fr });
}

export function timeAgo(date: Date | string) {
  return formatDistanceToNowStrict(typeof date === "string" ? new Date(date) : date, {
    locale: fr,
    addSuffix: true,
  });
}
