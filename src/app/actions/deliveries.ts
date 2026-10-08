"use server";

import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/dal";
import { recapCounts, renderRecapText } from "@/lib/recap";
import { runService, webActor } from "@/lib/services/core";
import * as deliveries from "@/lib/services/deliveries";

export async function createDelivery(
  projectId: string,
  input: { title: string; notes?: string; url?: string; deployedAt?: string },
) {
  const { userId } = await verifySession();
  return runService(async () => {
    await deliveries.recordDelivery(webActor(userId), projectId, input);
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

/**
 * Récap client prêt à envoyer : tâches faites depuis une date, regroupées par
 * page, puis ce qui attend le client et ce qui reste à faire.
 */
export async function buildRecap(projectId: string, sinceIso?: string) {
  await verifySession();
  return runService(async () => {
    const since = sinceIso && !Number.isNaN(new Date(sinceIso).getTime()) ? new Date(sinceIso) : undefined;
    const facts = await deliveries.buildRecapFacts(projectId, since);
    return { ok: true as const, text: renderRecapText(facts), counts: recapCounts(facts) };
  });
}
