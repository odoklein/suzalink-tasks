import "server-only";

import type { ProjectStatus } from "@prisma/client";

import { PROJECT_COLORS } from "@/lib/constants";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/services/activity";
import { parseInput, ServiceError, type Actor, type Tx } from "@/lib/services/core";
import { projectKey, slugify } from "@/lib/utils";
import { newProjectSchema, projectNoteSchema, projectStatusSchema, type NewProjectInput } from "@/lib/validation";

async function uniqueValue(tx: Tx, base: string, field: "slug" | "key") {
  let candidate = base;
  for (let i = 2; i < 50; i++) {
    const taken = await tx.project.findFirst({ where: { [field]: candidate }, select: { id: true } });
    if (!taken) return candidate;
    candidate = field === "slug" ? `${base}-${i}` : `${base}${i}`;
  }
  return `${base}-${Date.now()}`;
}

/** Crée un projet (et son client s'il est nouveau). `extra` : champs additionnels (CRM…). */
export async function createProject(actor: Actor, raw: NewProjectInput) {
  const input = parseInput(newProjectSchema, raw);
  return db.$transaction(async (tx) => {
    let clientId = input.clientId || null;
    if (input.newClient) {
      const client = await tx.client.create({ data: { name: input.newClient.name, kind: input.newClient.kind } });
      clientId = client.id;
    }
    const color = input.color || PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
    const slug = await uniqueValue(tx, slugify(input.name) || "projet", "slug");
    const key = await uniqueValue(tx, input.key || projectKey(input.name), "key");
    const project = await tx.project.create({
      data: {
        name: input.name,
        slug,
        key,
        color,
        clientId,
        endClient: input.endClient ?? null,
        siteUrl: input.siteUrl ?? null,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        leadId: actor.userId,
      },
    });
    await logActivity(tx, { projectId: project.id, actorId: actor.userId, message: "a créé le projet" });
    return project;
  });
}

export async function updateProjectStatus(actor: Actor, projectId: string, rawStatus: ProjectStatus) {
  const status = parseInput(projectStatusSchema, rawStatus);
  return db.$transaction(async (tx) => {
    const project = await tx.project.update({ where: { id: projectId }, data: { status } });
    await logActivity(tx, { projectId, actorId: actor.userId, message: "a changé le statut du projet" });
    return project;
  });
}

/** « Point d'étape » : où en est le projet et quelle est la prochaine action. */
export async function updateProjectNote(actor: Actor, raw: { projectId: string; note: string }) {
  const { projectId, note } = parseInput(projectNoteSchema, raw);
  return db.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: projectId },
      data: { statusNote: note || null, statusNoteAt: note ? new Date() : null },
    });
    if (note) await logActivity(tx, { projectId, actorId: actor.userId, message: "a mis à jour le point d'étape" });
    return project;
  });
}

export async function archiveProject(_actor: Actor, projectId: string) {
  return db.project.update({ where: { id: projectId }, data: { archived: true } });
}

/** Projets non archivés, pour l'API et le serveur MCP. */
export function listProjects(options: { includeArchived?: boolean } = {}) {
  return db.project.findMany({
    where: options.includeArchived ? {} : { archived: false },
    select: {
      id: true,
      name: true,
      slug: true,
      key: true,
      status: true,
      siteUrl: true,
      dueDate: true,
      statusNote: true,
      client: { select: { name: true, kind: true } },
      _count: { select: { tasks: { where: { status: { not: "DONE" } } } } },
    },
    orderBy: { name: "asc" },
  });
}

export async function requireProjectByKey(key: string) {
  const project = await db.project.findUnique({ where: { key: key.toUpperCase() } });
  if (!project) throw new ServiceError("Projet introuvable.", "NOT_FOUND");
  return project;
}
