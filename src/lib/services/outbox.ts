import "server-only";

import type { Prisma } from "@prisma/client";

import type { EventDraft, EventType } from "@/lib/events";
import type { Actor, Tx } from "@/lib/services/core";

/** Écrit un événement dans l'outbox, dans la transaction du changement. */
export async function emitEvent<T extends EventType>(tx: Tx, actor: Actor, event: EventDraft<T>) {
  await tx.event.create({
    data: {
      type: event.type,
      payload: event.payload as Prisma.InputJsonValue,
      via: actor.via,
      actorId: actor.userId,
      projectId: event.projectId ?? null,
      taskId: event.taskId ?? null,
    },
  });
}

/** Plusieurs événements en une requête (import, création en masse). */
export async function emitEvents(tx: Tx, actor: Actor, events: EventDraft[]) {
  if (events.length === 0) return;
  await tx.event.createMany({
    data: events.map((event) => ({
      type: event.type,
      payload: event.payload as Prisma.InputJsonValue,
      via: actor.via,
      actorId: actor.userId,
      projectId: event.projectId ?? null,
      taskId: event.taskId ?? null,
    })),
  });
}
