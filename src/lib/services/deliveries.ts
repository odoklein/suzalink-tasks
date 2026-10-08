import "server-only";

import { db } from "@/lib/db";
import type { ServiceRecapFacts as RecapFacts } from "@/lib/recap";
import { logActivity } from "@/lib/services/activity";
import { emitEvent } from "@/lib/services/outbox";
import { parseInput, ServiceError, taskRef, type Actor } from "@/lib/services/core";
import { deliverySchema } from "@/lib/validation";

export type DeliveryInput = { title: string; notes?: string | null; url?: string | null; deployedAt?: string | Date };

/** Enregistre une mise en ligne datée. */
export async function recordDelivery(actor: Actor, projectId: string, raw: DeliveryInput) {
  const input = parseInput(deliverySchema, {
    ...raw,
    deployedAt: raw.deployedAt instanceof Date ? raw.deployedAt.toISOString() : raw.deployedAt,
  });
  return db.$transaction(async (tx) => {
    const delivery = await tx.delivery.create({
      data: {
        projectId,
        authorId: actor.userId,
        title: input.title,
        notes: input.notes ?? null,
        url: input.url ?? null,
        deployedAt: input.deployedAt ? new Date(input.deployedAt) : new Date(),
      },
    });
    await logActivity(tx, { projectId, actorId: actor.userId, message: `a enregistré une mise en ligne : ${input.title}` });
    await emitEvent(tx, actor, {
      type: "delivery.created",
      projectId,
      payload: { deliveryId: delivery.id, title: delivery.title, deployedAt: delivery.deployedAt.toISOString(), url: delivery.url },
    });
    return delivery;
  });
}

/**
 * Faits du récap : tâches faites depuis `since`, ce qui attend le client,
 * ce qui reste chez nous, et la dernière mise en ligne.
 */
export async function buildRecapFacts(projectId: string, since?: Date | null): Promise<RecapFacts> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: { orderBy: [{ zone: "asc" }, { number: "asc" }] },
      deliveries: { orderBy: { deployedAt: "desc" }, take: 1 },
    },
  });
  if (!project) throw new ServiceError("Projet introuvable.", "NOT_FOUND");

  const toFact = (task: (typeof project.tasks)[number]) => ({
    ref: taskRef(project.key, task.number),
    title: task.title,
    zone: task.zone,
    status: task.status,
    statusChangedAt: task.statusChangedAt,
  });
  const lastDelivery = project.deliveries[0];
  return {
    project: { id: project.id, name: project.name, key: project.key, siteUrl: project.siteUrl },
    since: since ?? null,
    lastDelivery: lastDelivery ? { title: lastDelivery.title, deployedAt: lastDelivery.deployedAt, url: lastDelivery.url } : null,
    done: project.tasks
      .filter((task) => task.status === "DONE" && (!since || (task.completedAt && task.completedAt >= since)))
      .map(toFact),
    waiting: project.tasks.filter((task) => task.status === "WAITING_CLIENT").map(toFact),
    remaining: project.tasks.filter((task) => ["TODO", "IN_PROGRESS", "REVIEW"].includes(task.status)).map(toFact),
  };
}
