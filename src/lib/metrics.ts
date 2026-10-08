import type { TaskStatus } from "@prisma/client";

/**
 * Registre du temps passé dans chaque statut (P4-02), calculé à partir des
 * lignes d'activité `STATUS_CHANGED`. Module pur : les accès base sont dans
 * `src/lib/metrics-db.ts`.
 */

export const DAY_MS = 86_400_000;

export type StatusEvent = {
  at: Date;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
};

export type Interval = { status: TaskStatus; start: Date; end: Date };

export type TaskTimeline = {
  createdAt: Date;
  /** Statut actuel et depuis quand (Task.status / Task.statusChangedAt). */
  status: TaskStatus;
  statusChangedAt: Date;
};

/**
 * `waitingSince` après un changement de statut : posé à l'entrée dans
 * « Chez le client », conservé tant que la tâche y reste, effacé à la sortie.
 */
export function waitingSinceFor(
  from: TaskStatus,
  to: TaskStatus,
  now: Date,
  current: Date | null,
): Date | null {
  if (to !== "WAITING_CLIENT") return null;
  return from === "WAITING_CLIENT" ? (current ?? now) : now;
}

/**
 * Découpe la vie d'une tâche en intervalles « statut, début, fin ».
 *
 * - Chaque événement ferme l'intervalle précédent. Le statut de départ d'un
 *   événement est celui d'arrivée du précédent (les anciennes lignes
 *   rattrapées n'ont pas `fromStatus`).
 * - Avant le premier événement, le statut est `fromStatus` s'il est connu ;
 *   sinon cette période est inconnue et n'est pas comptée.
 * - Sans aucun événement exploitable, on ne connaît que le statut actuel
 *   depuis `statusChangedAt`.
 * - Le dernier intervalle court jusqu'à `now`, dans le statut actuel.
 */
export function statusIntervals(task: TaskTimeline, events: StatusEvent[], now: Date): Interval[] {
  const usable = events
    .filter((event) => event.toStatus !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  const intervals: Interval[] = [];
  if (usable.length === 0) {
    if (task.statusChangedAt < now) intervals.push({ status: task.status, start: task.statusChangedAt, end: now });
    return intervals;
  }

  let status: TaskStatus | null = usable[0].fromStatus;
  let start = task.createdAt;
  for (const event of usable) {
    if (status && event.at > start) intervals.push({ status, start, end: event.at });
    status = event.toStatus;
    start = event.at > start ? event.at : start;
  }
  if (start < now) intervals.push({ status: task.status, start, end: now });
  return intervals;
}

/** Durée (ms) passée dans chaque statut. */
export function timeInStatusFromIntervals(intervals: Interval[]): Record<TaskStatus, number> {
  const totals: Record<TaskStatus, number> = {
    TODO: 0,
    IN_PROGRESS: 0,
    WAITING_CLIENT: 0,
    REVIEW: 0,
    DONE: 0,
  };
  for (const { status, start, end } of intervals) totals[status] += end.getTime() - start.getTime();
  return totals;
}

/** Restreint des intervalles à la fenêtre [from, to). */
export function clipIntervals(intervals: Interval[], from: Date, to: Date): Interval[] {
  return intervals
    .map((interval) => ({
      ...interval,
      start: interval.start < from ? from : interval.start,
      end: interval.end > to ? to : interval.end,
    }))
    .filter((interval) => interval.end > interval.start);
}

/** Longueur (ms) de l'union de plages : deux tâches en attente en même temps comptent une fois. */
export function unionLength(ranges: { start: Date; end: Date }[]): number {
  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  let total = 0;
  let curStart = 0;
  let curEnd = 0;
  for (const [index, range] of sorted.entries()) {
    const start = range.start.getTime();
    const end = range.end.getTime();
    if (index === 0 || start > curEnd) {
      total += curEnd - curStart;
      curStart = start;
      curEnd = end;
    } else if (end > curEnd) {
      curEnd = end;
    }
  }
  return total + (sorted.length ? curEnd - curStart : 0);
}

/**
 * Jours « chez le client » d'un projet sur [from, to) :
 * - `blockedDays` : jours où au moins une tâche attendait le client (union) ;
 * - `taskDays` : somme des attentes de chaque tâche (une tâche attendant 3 j et une autre 2 j en parallèle : 5).
 */
export function projectWaitingDaysFromTimelines(
  timelines: { task: TaskTimeline; events: StatusEvent[] }[],
  from: Date,
  to: Date,
  now: Date = to,
): { blockedDays: number; taskDays: number } {
  const waiting = timelines.flatMap(({ task, events }) =>
    clipIntervals(statusIntervals(task, events, now), from, to).filter((i) => i.status === "WAITING_CLIENT"),
  );
  const taskMs = waiting.reduce((sum, i) => sum + (i.end.getTime() - i.start.getTime()), 0);
  return { blockedDays: unionLength(waiting) / DAY_MS, taskDays: taskMs / DAY_MS };
}
