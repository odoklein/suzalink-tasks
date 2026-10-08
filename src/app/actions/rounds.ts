"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";

/**
 * Clôture un lot de retours, avec la mise en ligne qui l'a livré (statut
 * « Mis en ligne ») ou sans (statut « Clôturé »).
 */
export async function closeRound(roundId: string, deliveryId: string | null) {
  const { userId } = await verifySession();
  const round = await db.feedbackRound.findUnique({ where: { id: roundId }, select: { projectId: true, label: true } });
  if (!round) return { error: "Lot de retours introuvable." };
  const delivery = deliveryId
    ? await db.delivery.findFirst({ where: { id: deliveryId, projectId: round.projectId }, select: { id: true, title: true } })
    : null;
  if (deliveryId && !delivery) return { error: "Mise en ligne introuvable." };

  await db.$transaction(async (tx) => {
    await tx.feedbackRound.update({
      where: { id: roundId },
      data: { status: delivery ? "DELIVERED" : "CLOSED", closedById: delivery?.id ?? null },
    });
    await logActivity(tx, {
      projectId: round.projectId,
      actorId: userId,
      event: {
        type: "NOTE",
        message: delivery
          ? `a clôturé le lot « ${round.label} » avec la mise en ligne « ${delivery.title} »`
          : `a clôturé le lot « ${round.label} »`,
      },
    });
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function reopenRound(roundId: string) {
  await verifySession();
  await db.feedbackRound.update({ where: { id: roundId }, data: { status: "OPEN", closedById: null } });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
