import "server-only";

import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  projectWaitingDaysFromTimelines,
  statusIntervals,
  timeInStatusFromIntervals,
  type StatusEvent,
} from "@/lib/metrics";

const toEvents = (rows: { createdAt: Date; fromStatus: StatusEvent["fromStatus"]; toStatus: StatusEvent["toStatus"] }[]) =>
  rows.map((row) => ({ at: row.createdAt, fromStatus: row.fromStatus, toStatus: row.toStatus }));

/** Temps (ms) passé par une tâche dans chaque statut, jusqu'à maintenant. */
export async function timeInStatus(taskId: string) {
  await verifySession();
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: {
      createdAt: true,
      status: true,
      statusChangedAt: true,
      activities: {
        where: { type: "STATUS_CHANGED" },
        select: { createdAt: true, fromStatus: true, toStatus: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!task) return null;
  return timeInStatusFromIntervals(statusIntervals(task, toEvents(task.activities), new Date()));
}

/** Jours « chez le client » d'un projet sur la fenêtre [from, to). */
export async function projectWaitingDays(projectId: string, from: Date, to: Date) {
  await verifySession();
  const tasks = await db.task.findMany({
    where: { projectId },
    select: {
      createdAt: true,
      status: true,
      statusChangedAt: true,
      activities: {
        where: { type: "STATUS_CHANGED" },
        select: { createdAt: true, fromStatus: true, toStatus: true },
      },
    },
  });
  return projectWaitingDaysFromTimelines(
    tasks.map((task) => ({ task, events: toEvents(task.activities) })),
    from,
    to,
  );
}
