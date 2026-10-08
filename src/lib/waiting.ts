import { startOfDayParis } from "@/lib/time";

const DAY = 24 * 60 * 60 * 1000;

/** Jours (calendaires, heure de Paris) passés chez le client depuis le dernier changement de statut. */
export function waitingDays(statusChangedAt: Date | string, now: Date | number = Date.now()): number {
  const from = startOfDayParis(statusChangedAt).getTime();
  const to = startOfDayParis(now).getTime();
  // Arrondi : un jour de changement d’heure dure 23 ou 25 h.
  return Math.max(0, Math.round((to - from) / DAY));
}

/** 0 à 2 jours : discret ; 3 à 4 : à surveiller ; 5 et plus : à relancer. */
export function waitingLevel(days: number): "calm" | "watch" | "chase" {
  if (days >= 5) return "chase";
  if (days >= 3) return "watch";
  return "calm";
}

/** Plus grande attente d’une liste de tâches chez le client (0 si vide). */
export function oldestWaitingDays(tasks: { status: string; statusChangedAt: Date | string }[], now?: Date | number): number {
  return tasks
    .filter((task) => task.status === "WAITING_CLIENT")
    .reduce((max, task) => Math.max(max, waitingDays(task.statusChangedAt, now)), 0);
}
