"use server";

import { revalidatePath } from "next/cache";

import { isAdmin } from "@/lib/admin";
import { retryJob } from "@/lib/jobs/queue";
import { idSchema } from "@/lib/validation";

/** « Relancer » un travail en échec (administrateurs). */
export async function retryFailedJob(jobId: string) {
  if (!(await isAdmin())) return { error: "Réservé aux administrateurs." };
  const id = idSchema.safeParse(jobId);
  if (!id.success) return { error: "Travail introuvable." };
  await retryJob(id.data);
  revalidatePath("/settings/integrations");
  return { ok: true as const };
}
