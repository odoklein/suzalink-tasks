import type { Channel, RoundStatus, TaskStatus } from "@prisma/client";

/** Lots de retours (P4-06) : comptes d'une carte et regroupement des anciennes tâches. Module pur. */

export const ROUND_STATUS_LABELS: Record<RoundStatus, string> = {
  OPEN: "En cours",
  DELIVERED: "Mis en ligne",
  CLOSED: "Clôturé",
};

export type RoundCounts = { total: number; done: number; waiting: number; remaining: number };

/** « faites / chez le client / restantes » : chaque tâche compte dans exactement une case. */
export function roundCounts(tasks: { status: TaskStatus }[]): RoundCounts {
  const counts: RoundCounts = { total: tasks.length, done: 0, waiting: 0, remaining: 0 };
  for (const task of tasks) {
    if (task.status === "DONE") counts.done++;
    else if (task.status === "WAITING_CLIENT") counts.waiting++;
    else counts.remaining++;
  }
  return counts;
}

export type LegacyTask = { id: string; projectId: string; source: string | null; createdAt: Date; status: TaskStatus };

export type LegacyRound = {
  projectId: string;
  label: string;
  receivedAt: Date;
  status: RoundStatus;
  channel: Channel;
  taskIds: string[];
};

/**
 * Regroupe les tâches sans lot par (projet, source) pour le rattrapage : un lot
 * par source, reçu à la date de la plus ancienne tâche, clôturé si tout est fait.
 */
export function groupLegacyRounds(tasks: LegacyTask[]): LegacyRound[] {
  const groups = new Map<string, LegacyTask[]>();
  for (const task of tasks) {
    const label = task.source?.trim();
    if (!label) continue;
    const key = `${task.projectId}\u0000${label}`;
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  return [...groups.values()].map((items) => {
    const label = items[0].source!.trim();
    return {
      projectId: items[0].projectId,
      label,
      receivedAt: new Date(Math.min(...items.map((task) => task.createdAt.getTime()))),
      status: items.every((task) => task.status === "DONE") ? "CLOSED" : "OPEN",
      channel: /^retours/i.test(label) ? "SHEETS" : "WEB",
      taskIds: items.map((task) => task.id),
    };
  });
}
