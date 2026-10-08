"use server";

import type { ClientKind, Prisma, ProjectStatus, ProjectType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { safe } from "@/lib/action";
import { logActivity } from "@/lib/activity";
import { applyTemplate } from "@/lib/apply-template";
import { PROJECT_COLORS } from "@/lib/constants";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { plural } from "@/lib/plural";
import { PROJECT_TYPES } from "@/lib/templates";
import { fromParisDateInput, fromParisDateTimeInput, startOfDayParis } from "@/lib/time";
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

    const templateId = String(formData.get("templateId") ?? "") || null;
    const typeValue = String(formData.get("type") ?? "");
    const type: ProjectType = PROJECT_TYPES.some((t) => t.value === typeValue) ? (typeValue as ProjectType) : "OTHER";
    const startValue = String(formData.get("startDate") ?? "");
    const start = startValue ? fromParisDateTimeInput(`${startValue}T00:00`) : startOfDayParis(new Date());
    if (Number.isNaN(start.getTime())) return { error: "Date de démarrage invalide." };

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
          type,
          startDate: start,
        },
      });
      await logActivity(tx, { projectId: created.id, actorId: userId, event: { type: "PROJECT_UPDATED", change: "created" } });
      if (templateId) {
        const applied = await applyTemplate(tx, { projectId: created.id, templateId, start, creatorId: userId });
        if (applied) {
          await logActivity(tx, {
            projectId: created.id,
            actorId: userId,
            event: { type: "NOTE", message: `a appliqué le modèle « ${applied.name} » (${plural(applied.count, "tâche")})` },
          });
        }
      }
      return created;
    });
    revalidatePath("/", "layout");
    redirect(`/projects/${project.slug}`);
  });
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  return safe(async () => {
    const { userId } = await verifySession();
    await db.$transaction(async (tx) => {
      const before = await tx.project.findUnique({ where: { id: projectId }, select: { status: true } });
      if (!before || before.status === status) return;
      await tx.project.update({ where: { id: projectId }, data: { status } });
      await logActivity(tx, {
        projectId,
        actorId: userId,
        event: { type: "PROJECT_UPDATED", change: "status", from: before.status, to: status },
      });
    });
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

/** « Point d'étape » : où en est le projet et quelle est la prochaine action. */
export async function updateProjectNote(projectId: string, note: string) {
  return safe(async () => {
    const { userId } = await verifySession();
    const text = note.trim().slice(0, 600);
    await db.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: projectId },
        data: { statusNote: text || null, statusNoteAt: text ? new Date() : null },
      });
      if (text) await logActivity(tx, { projectId, actorId: userId, event: { type: "PROJECT_UPDATED", change: "note" } });
    });
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
