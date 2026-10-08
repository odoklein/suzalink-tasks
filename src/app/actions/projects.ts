"use server";

import type { ClientKind, Prisma, ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PROJECT_COLORS } from "@/lib/constants";
import { safe } from "@/lib/action";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { fromParisDateInput } from "@/lib/time";
import { projectKey, slugify } from "@/lib/utils";
import { DESCRIPTION_MAX, parseHttpUrl, parseProjectKey } from "@/lib/validate";

export type ProjectFormState = { error?: string } | undefined;

async function uniqueValue(tx: Prisma.TransactionClient, base: string, field: "slug" | "key") {
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const taken = await tx.project.findFirst({ where: { [field]: candidate }, select: { id: true } });
    if (!taken) return candidate;
    candidate = field === "slug" ? `${base}-${i}` : `${base}${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createProject(_state: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  return safe(async () => {
    const { userId } = await verifySession();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { error: "Donnez un nom au projet." };

    const wantedKey = parseProjectKey(formData.get("key"));
    if (wantedKey === undefined) return { error: "Le préfixe doit faire 1 à 4 lettres ou chiffres (ex. BG)." };
    const siteUrl = parseHttpUrl(formData.get("siteUrl"));
    if (siteUrl === undefined) return { error: "Le lien du site doit commencer par http:// ou https://." };
    const due = String(formData.get("dueDate") ?? "");
    const dueDate = due ? fromParisDateInput(due) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) return { error: "Échéance invalide." };

    const newClient = String(formData.get("newClient") ?? "").trim();
    const color = String(formData.get("color") ?? "") || PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];

    // Client et projet ensemble : pas de client orphelin si la création du projet échoue.
    const project = await db.$transaction(async (tx) => {
      let clientId = String(formData.get("clientId") ?? "") || null;
      if (newClient) {
        const kind: ClientKind = formData.get("clientKind") === "AGENCY" ? "AGENCY" : "DIRECT";
        const client = await tx.client.create({ data: { name: newClient, kind } });
        clientId = client.id;
      }
      const slug = await uniqueValue(tx, slugify(name) || "projet", "slug");
      const key = await uniqueValue(tx, wantedKey ?? projectKey(name), "key");
      const created = await tx.project.create({
        data: {
          name,
          slug,
          key,
          color,
          clientId,
          endClient: String(formData.get("endClient") ?? "").trim() || null,
          siteUrl,
          description: String(formData.get("description") ?? "").trim().slice(0, DESCRIPTION_MAX) || null,
          dueDate,
          leadId: userId,
        },
      });
      await tx.activity.create({ data: { projectId: created.id, actorId: userId, message: "a créé le projet" } });
      return created;
    });
    revalidatePath("/", "layout");
    redirect(`/projects/${project.slug}`);
  });
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  return safe(async () => {
    const { userId } = await verifySession();
    await db.project.update({ where: { id: projectId }, data: { status } });
    await db.activity.create({ data: { projectId, actorId: userId, message: "a changé le statut du projet" } });
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

/** « Point d'étape » : où en est le projet et quelle est la prochaine action. */
export async function updateProjectNote(projectId: string, note: string) {
  return safe(async () => {
    const { userId } = await verifySession();
    const text = note.trim().slice(0, 600);
    await db.project.update({
      where: { id: projectId },
      data: { statusNote: text || null, statusNoteAt: text ? new Date() : null },
    });
    if (text) await db.activity.create({ data: { projectId, actorId: userId, message: "a mis à jour le point d’étape" } });
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

export async function archiveProject(projectId: string) {
  return safe(async () => {
    await verifySession();
    await db.project.update({ where: { id: projectId }, data: { archived: true } });
    revalidatePath("/", "layout");
    redirect("/projects");
  });
}
