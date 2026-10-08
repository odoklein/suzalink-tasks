import "server-only";

import type { Event } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Consommateurs de l'outbox. Chacun reçoit un lot d'événements non encore
 * distribués ; il doit tolérer de revoir un événement (livraison « au moins
 * une fois » : en cas d'échec, tout le lot est redistribué).
 */
export type EventConsumer = { name: string; handle: (events: Event[]) => Promise<void> };

const consumers: EventConsumer[] = [];

export function registerConsumer(consumer: EventConsumer) {
  if (!consumers.some((existing) => existing.name === consumer.name)) consumers.push(consumer);
}

export async function dispatchPendingEvents(batchSize = 200) {
  const events = await db.event.findMany({
    where: { dispatchedAt: null },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });
  if (events.length === 0) return 0;
  for (const consumer of consumers) {
    await consumer.handle(events);
  }
  await db.event.updateMany({ where: { id: { in: events.map((event) => event.id) } }, data: { dispatchedAt: new Date() } });
  return events.length;
}
