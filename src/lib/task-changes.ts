import type { Priority, TaskStatus } from "@prisma/client";

import type { ActivityEvent, Person } from "@/lib/activity-copy";

/** Champs d'une tâche dont la modification doit laisser une trace dans l'historique. */
export type TrackedTask = {
  title: string;
  status: TaskStatus;
  priority: Priority;
  billable: boolean;
  dueDate: Date | null;
  assigneeId: string | null;
};

/**
 * Compare l'état d'une tâche avant et après modification et renvoie un
 * événement par champ réellement modifié (dans un ordre stable).
 * `people` fournit les noms pour l'attribution.
 */
export function diffTask(
  ref: string,
  before: TrackedTask,
  after: TrackedTask,
  people: ReadonlyMap<string, Person> = new Map(),
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const person = (id: string | null): Person | null => (id ? (people.get(id) ?? { id, name: "un membre" }) : null);

  if (before.status !== after.status) {
    events.push({ type: "STATUS_CHANGED", ref, from: before.status, to: after.status });
  }
  if (before.assigneeId !== after.assigneeId) {
    events.push({ type: "ASSIGNED", ref, from: person(before.assigneeId), to: person(after.assigneeId) });
  }
  if (before.billable !== after.billable) {
    events.push({ type: "BILLABLE_CHANGED", ref, from: before.billable, to: after.billable });
  }
  if ((before.dueDate?.getTime() ?? null) !== (after.dueDate?.getTime() ?? null)) {
    events.push({ type: "DUE_CHANGED", ref, from: before.dueDate, to: after.dueDate });
  }
  if (before.priority !== after.priority) {
    events.push({ type: "PRIORITY_CHANGED", ref, from: before.priority, to: after.priority });
  }
  if (before.title !== after.title) {
    events.push({ type: "TITLE_CHANGED", ref, from: before.title, to: after.title });
  }
  return events;
}
