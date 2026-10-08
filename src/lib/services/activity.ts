import "server-only";

import type { Tx } from "@/lib/services/core";

/**
 * Journal d'activité affiché dans l'interface (message libre, comme avant).
 * À la fusion avec P4-01, remplacer par `logActivity(tx, { type, … })` de
 * src/lib/activity.ts : les appels sont tous dans les services.
 */
export async function logActivity(
  tx: Tx,
  entry: { projectId: string; actorId: string | null; message: string; taskId?: string | null },
) {
  await tx.activity.create({
    data: {
      projectId: entry.projectId,
      actorId: entry.actorId,
      message: entry.message,
      taskId: entry.taskId ?? undefined,
    },
  });
}
