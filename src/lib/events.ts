import type { TaskStatus } from "@prisma/client";

/**
 * Types d'événements de l'outbox (table Event) et leur charge utile.
 * Pas de `server-only` : le typage sert aussi aux tests et à l'API.
 */
export type EventPayloads = {
  "task.created": { ref: string; title: string; status: TaskStatus; assigneeId: string | null };
  "task.status_changed": { ref: string; title: string; from: TaskStatus; to: TaskStatus };
  "task.assigned": { ref: string; title: string; from: string | null; to: string | null };
  "task.updated": { ref: string; title: string; fields: string[] };
  "task.deleted": { ref: string; title: string };
  "comment.created": { ref: string; commentId: string; excerpt: string };
  "delivery.created": { deliveryId: string; title: string; deployedAt: string; url: string | null };
  "project.created": { key: string; name: string };
  "project.note_updated": { note: string | null };
  "client_message.sent": { kind: string; messageId?: string; channel?: string };
};

export type EventType = keyof EventPayloads;

export const EVENT_TYPES = [
  "task.created",
  "task.status_changed",
  "task.assigned",
  "task.updated",
  "task.deleted",
  "comment.created",
  "delivery.created",
  "project.created",
  "project.note_updated",
  "client_message.sent",
] as const satisfies readonly EventType[];

export type EventDraft<T extends EventType = EventType> = {
  type: T;
  payload: EventPayloads[T];
  projectId?: string | null;
  taskId?: string | null;
};

/** Champs modifiés d'une tâche (pour `task.updated`), hors statut et attribution qui ont leur propre type. */
export function changedFields(before: Record<string, unknown>, patch: Record<string, unknown>): string[] {
  const ignored = new Set(["status", "statusChangedAt", "position", "completedAt", "assigneeId"]);
  return Object.keys(patch).filter((key) => {
    if (ignored.has(key)) return false;
    const a = before[key];
    const b = patch[key];
    if (a instanceof Date || b instanceof Date) {
      return (a instanceof Date ? a.getTime() : a) !== (b instanceof Date ? b.getTime() : b);
    }
    return a !== b;
  });
}
