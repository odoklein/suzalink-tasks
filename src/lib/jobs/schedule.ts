import { tz } from "@date-fns/tz";
import { addMinutes, startOfISOWeek } from "date-fns";

import { formatParis, fromParisDateTimeInput, TZ } from "@/lib/time";

/** Au-delà, un travail n'est plus repris automatiquement (« Relancer » dans Paramètres). */
export const MAX_ATTEMPTS = 6;

/** Un verrou plus vieux que ça est considéré comme abandonné (fonction coupée en plein travail). */
export const STALE_LOCK_MINUTES = 5;

/** Attente avant la prochaine tentative : 2^tentatives minutes (2, 4, 8… min). */
export function backoffDelayMinutes(attempts: number): number {
  return 2 ** Math.max(1, attempts);
}

export function nextRunAfterFailure(now: Date, attempts: number): Date {
  return addMinutes(now, backoffDelayMinutes(attempts));
}

/** Le cron est en retard si son dernier passage date de plus de `minutes`. */
export function isStale(last: Date | null | undefined, minutes: number, now: Date = new Date()): boolean {
  return !last || now.getTime() - last.getTime() > minutes * 60_000;
}

export type RecurringJob = { kind: string; dedupeKey: string; runAt: Date; payload?: Record<string, unknown> };

/** Lundi de la semaine ISO (heure de Paris) au format `yyyy-MM-dd`. */
function parisWeekMonday(now: Date): string {
  return formatParis(startOfISOWeek(now, { in: tz(TZ) }), "yyyy-MM-dd");
}

/**
 * Travaux récurrents insérés à chaque passage du cron. La clé de
 * déduplication garantit une seule ligne par minute, jour ou semaine même si
 * le cron est appelé deux fois.
 */
export function recurringJobs(now: Date): RecurringJob[] {
  const day = formatParis(now, "yyyy-MM-dd");
  const week = formatParis(now, "RRRR-'W'II");
  return [
    { kind: "dispatch_events", dedupeKey: `dispatch:${formatParis(now, "yyyy-MM-dd'T'HH:mm")}`, runAt: now },
    // Relances, tâches récurrentes, purge : chaque jour à 6 h (Paris).
    { kind: "daily", dedupeKey: `daily:${day}`, runAt: fromParisDateTimeInput(`${day}T06:00`) },
    // Récapitulatif de la semaine : lundi 8 h (Paris).
    { kind: "digest", dedupeKey: `digest:${week}`, runAt: fromParisDateTimeInput(`${parisWeekMonday(now)}T08:00`) },
  ];
}
