import "server-only";

import type { Prisma } from "@prisma/client";

import { describeActivity, type ActivityEvent } from "@/lib/activity-copy";

/** Client Prisma ou transaction : seule la table `activity` est utilisée. */
type ActivityClient = { activity: Pick<Prisma.TransactionClient["activity"], "create" | "createMany"> };

type LogInput = {
  projectId: string;
  taskId?: string | null;
  actorId: string | null;
  event: ActivityEvent;
};

function toRow({ projectId, taskId, actorId, event }: LogInput) {
  const { type, message, fromStatus, toStatus, data } = describeActivity(event);
  return {
    projectId,
    taskId: taskId ?? null,
    actorId,
    type,
    message,
    fromStatus: fromStatus ?? null,
    toStatus: toStatus ?? null,
    data: (data ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

/**
 * Écrit une ligne d'activité. À appeler avec le `tx` de la transaction qui
 * porte la modification : si elle échoue, l'historique n'est pas écrit.
 */
export async function logActivity(tx: ActivityClient, input: LogInput) {
  await tx.activity.create({ data: toRow(input) });
}

/** Plusieurs lignes d'un coup (une modification qui touche plusieurs champs). */
export async function logActivities(tx: ActivityClient, inputs: LogInput[]) {
  if (inputs.length === 0) return;
  await tx.activity.createMany({ data: inputs.map(toRow) });
}
