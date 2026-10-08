"use server";

import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { ensureZone } from "@/lib/zones";

/**
 * « Fusionner les pages » : « Homepage », « Accueil » et « Home » deviennent
 * une seule page. Les tâches sont renommées et rattachées à la page cible.
 */
export async function mergeZones(projectId: string, fromNames: string[], into: string) {
  const { userId } = await verifySession();
  const target = into.trim().slice(0, 120);
  const sources = [...new Set(fromNames.map((name) => name.trim()).filter((name) => name && name !== target))];
  if (!target) return { error: "Choisissez le nom de la page fusionnée." };
  if (sources.length === 0) return { error: "Sélectionnez au moins une autre page à fusionner." };

  const moved = await db.$transaction(async (tx) => {
    const zoneId = await ensureZone(tx, projectId, target);
    const result = await tx.task.updateMany({
      where: { projectId, zone: { in: sources } },
      data: { zone: target, zoneId },
    });
    await tx.zone.deleteMany({ where: { projectId, name: { in: sources } } });
    await logActivity(tx, {
      projectId,
      actorId: userId,
      event: {
        type: "NOTE",
        message: `a fusionné les pages ${sources.map((s) => `« ${s} »`).join(", ")} dans « ${target} »`,
      },
    });
    return result.count;
  });
  revalidatePath("/", "layout");
  return { ok: true as const, moved };
}
