"use server";

import type { ClientKind, ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { PROJECT_COLORS } from "@/lib/constants";
import { safe } from "@/lib/action";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { projectKey, slugify } from "@/lib/utils";

export type ProjectFormState = { error?: string } | undefined;

async function uniqueValue(base: string, field: "slug" | "key") {
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const taken = await db.project.findFirst({ where: { [field]: candidate }, select: { id: true } });
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

    let clientId = String(formData.get("clientId") ?? "") || null;
    const newClient = String(formData.get("newClient") ?? "").trim();
    if (newClient) {
      const kind: ClientKind = formData.get("clientKind") === "AGENCY" ? "AGENCY" : "DIRECT";
      const client = await db.client.create({ data: { name: newClient, kind } });
      clientId = client.id;
    }

    const color = String(formData.get("color") ?? "") || PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
    const due = String(formData.get("dueDate") ?? "");
    const slug = await uniqueValue(slugify(name) || "projet", "slug");
    const key = await uniqueValue(String(formData.get("key") ?? "").trim().toUpperCase() || projectKey(name), "key");

    const project = await db.project.create({
      data: {
        name,
        slug,
        key,
        color,
        clientId,
        endClient: String(formData.get("endClient") ?? "").trim() || null,
        siteUrl: String(formData.get("siteUrl") ?? "").trim() || null,
        description: String(formData.get("description") ?? "").trim() || null,
        dueDate: due ? new Date(due) : null,
        leadId: userId,
      },
    });
    await db.activity.create({ data: { projectId: project.id, actorId: userId, message: "a créé le projet" } });
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
    if (text) await db.activity.create({ data: { projectId, actorId: userId, message: "a mis à jour le point d'étape" } });
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
