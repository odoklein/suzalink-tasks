"use server";

import { Prisma, type Priority, type TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logActivities, logActivity } from "@/lib/activity";
import type { Person } from "@/lib/activity-copy";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import type { ColumnMapping } from "@/lib/feedback-import";
import { ImportError, matchImportRows, runImport, type ImportInput } from "@/lib/import-feedback";
import { waitingSinceFor } from "@/lib/metrics";
import { parseQuickAdd } from "@/lib/quick-add";
import { diffTask } from "@/lib/task-changes";
import { ensureZone } from "@/lib/zones";

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "WAITING_CLIENT", "REVIEW", "DONE"];
const PRIORITIES: Priority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];

function refresh() {
  revalidatePath("/", "layout");
}

async function nextPosition(projectId: string, status: TaskStatus) {
  const last = await db.task.findFirst({
    where: { projectId, status },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? 0) + 1000;
}

type NewTask = {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  zone?: string;
  source?: string;
  billable?: boolean;
  estimatedAmountCents?: number | null;
  assigneeId?: string | null;
  dueDate?: Date | null;
  roundId?: string | null;
};

async function insertTask(input: NewTask, creatorId: string) {
  const status = input.status ?? "TODO";
  const position = await nextPosition(input.projectId, status);
  return db.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: input.projectId },
      data: { taskCounter: { increment: 1 } },
      select: { taskCounter: true, key: true },
    });
    const zoneId = await ensureZone(tx, input.projectId, input.zone);
    const task = await tx.task.create({
      data: {
        projectId: input.projectId,
        number: project.taskCounter,
        title: input.title,
        description: input.description,
        status,
        priority: input.priority ?? "NONE",
        zone: input.zone,
        source: input.source,
        billable: input.billable ?? false,
        estimatedAmountCents: input.estimatedAmountCents ?? null,
        assigneeId: input.assigneeId ?? null,
        dueDate: input.dueDate ?? null,
        creatorId,
        position,
        completedAt: status === "DONE" ? new Date() : null,
        waitingSince: status === "WAITING_CLIENT" ? new Date() : null,
        roundId: input.roundId ?? null,
        zoneId,
      },
    });
    const ref = `${project.key}-${task.number}`;
    await logActivity(tx, {
      projectId: input.projectId,
      taskId: task.id,
      actorId: creatorId,
      event: { type: "TASK_CREATED", ref, title: task.title },
    });
    return { task, ref };
  });
}

/** Saisie rapide depuis un projet ou depuis « Aujourd'hui ». */
export async function quickAddTask(
  projectId: string,
  input: string,
  status?: TaskStatus,
  options: { roundId?: string | null } = {},
) {
  const { userId } = await verifySession();
  const team = await db.user.findMany({ select: { id: true, name: true } });
  const parsed = parseQuickAdd(input, team);
  if (!parsed.title) return { error: "Donnez un titre à la tâche." };

  // Ajout à un lot de retours ouvert (P4-06) : la tâche hérite de son libellé comme source.
  const round = options.roundId
    ? await db.feedbackRound.findFirst({
        where: { id: options.roundId, projectId, status: "OPEN" },
        select: { id: true, label: true },
      })
    : null;

  const { ref } = await insertTask(
    {
      projectId,
      title: parsed.title,
      status: status && STATUSES.includes(status) ? status : "TODO",
      priority: parsed.priority,
      zone: parsed.zone,
      billable: parsed.billable,
      estimatedAmountCents: parsed.amountCents ?? null,
      assigneeId: parsed.assigneeId ?? null,
      dueDate: parsed.dueDate ?? null,
      roundId: round?.id ?? null,
      source: round?.label,
    },
    userId,
  );
  refresh();
  return { ok: true as const, ref };
}

export type TaskPatch = Partial<{
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  zone: string | null;
  source: string | null;
  billable: boolean;
  billingNote: string | null;
  estimatedAmountCents: number | null;
  assigneeId: string | null;
  dueDate: string | null;
}>;

export async function updateTask(taskId: string, patch: TaskPatch) {
  const { userId } = await verifySession();
  const current = await db.task.findUnique({
    where: { id: taskId },
    include: { project: { select: { key: true } } },
  });
  if (!current) return { error: "Tâche introuvable." };

  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) return { error: "Le titre ne peut pas être vide." };
    data.title = title;
  }
  if (patch.description !== undefined) data.description = patch.description?.trim() || null;
  if (patch.priority !== undefined && PRIORITIES.includes(patch.priority)) data.priority = patch.priority;
  if (patch.zone !== undefined) data.zone = patch.zone?.trim() || null;
  if (patch.source !== undefined) data.source = patch.source?.trim() || null;
  if (patch.billable !== undefined) data.billable = patch.billable;
  if (patch.billingNote !== undefined) data.billingNote = patch.billingNote?.trim().slice(0, 500) || null;
  if (patch.estimatedAmountCents !== undefined) {
    const cents = patch.estimatedAmountCents;
    if (cents !== null && (!Number.isInteger(cents) || cents < 0)) return { error: "Montant invalide." };
    data.estimatedAmountCents = cents;
  }
  if (patch.assigneeId !== undefined) data.assigneeId = patch.assigneeId || null;
  if (patch.dueDate !== undefined) data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
  if (patch.status !== undefined && STATUSES.includes(patch.status) && patch.status !== current.status) {
    data.status = patch.status;
    data.statusChangedAt = new Date();
    data.waitingSince = waitingSinceFor(current.status, patch.status, new Date(), current.waitingSince);
    if (patch.status !== "WAITING_CLIENT") Object.assign(data, { waitingFor: null, followUpAt: null });
    data.position = await nextPosition(current.projectId, patch.status);
    data.completedAt = patch.status === "DONE" ? new Date() : null;
  }

  const ref = `${current.project.key}-${current.number}`;
  await db.$transaction(async (tx) => {
    if (data.zone !== undefined) data.zoneId = await ensureZone(tx, current.projectId, data.zone as string | null);
    const updated = await tx.task.update({ where: { id: taskId }, data });

    // Une ligne d'historique par champ réellement modifié, dans la même transaction.
    const ids = [current.assigneeId, updated.assigneeId].filter((id): id is string => !!id);
    const people = new Map<string, Person>(
      ids.length ? (await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((u) => [u.id, u]) : [],
    );
    await logActivities(
      tx,
      diffTask(ref, current, updated, people).map((event) => ({
        projectId: current.projectId,
        taskId,
        actorId: userId,
        event,
      })),
    );
  });
  refresh();
  return { ok: true as const };
}

/** Glisser-déposer sur le tableau : nouvelle colonne et nouvelle position. */
export async function moveTask(taskId: string, status: TaskStatus, position: number) {
  const { userId } = await verifySession();
  if (!STATUSES.includes(status)) return { error: "Statut inconnu." };
  const current = await db.task.findUnique({
    where: { id: taskId },
    include: { project: { select: { key: true } } },
  });
  if (!current) return { error: "Tâche introuvable." };

  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        status,
        position,
        completedAt: status === "DONE" ? (current.completedAt ?? new Date()) : null,
        ...(status !== current.status
          ? {
              statusChangedAt: new Date(),
              waitingSince: waitingSinceFor(current.status, status, new Date(), current.waitingSince),
              ...(status !== "WAITING_CLIENT" ? { waitingFor: null, followUpAt: null } : {}),
            }
          : {}),
      },
    });
    if (status !== current.status) {
      await logActivity(tx, {
        projectId: current.projectId,
        taskId,
        actorId: userId,
        event: { type: "STATUS_CHANGED", ref: `${current.project.key}-${current.number}`, from: current.status, to: status },
      });
    }
  });
  refresh();
  return { ok: true as const };
}

export async function deleteTask(taskId: string) {
  const { userId } = await verifySession();
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { project: { select: { key: true } } },
  });
  if (!task) return { error: "Tâche introuvable." };
  // Pas de taskId : la ligne d'activité doit survivre à la tâche (cascade sinon).
  await db.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: taskId } });
    await logActivity(tx, {
      projectId: task.projectId,
      actorId: userId,
      event: { type: "TASK_DELETED", ref: `${task.project.key}-${task.number}`, title: task.title },
    });
  });
  refresh();
  return { ok: true as const };
}

export async function getTaskDetail(taskId: string) {
  await verifySession();
  return db.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, key: true, name: true, slug: true, color: true } },
      creator: { select: { name: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, color: true } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { actor: { select: { name: true } } },
      },
    },
  });
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

export async function addComment(taskId: string, body: string) {
  const { userId } = await verifySession();
  const text = body.trim();
  if (!text) return { error: "Le commentaire est vide." };
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { project: { select: { key: true } } },
  });
  if (!task) return { error: "Tâche introuvable." };
  await db.$transaction(async (tx) => {
    await tx.comment.create({ data: { taskId, authorId: userId, body: text } });
    await logActivity(tx, {
      projectId: task.projectId,
      taskId,
      actorId: userId,
      event: { type: "COMMENTED", ref: `${task.project.key}-${task.number}` },
    });
  });
  refresh();
  return { ok: true as const };
}


/**
 * Aperçu d'un import : pour chaque ligne collée, la tâche existante portant la
 * même clé de déduplication (null si la ligne est nouvelle).
 */
export async function previewImport(projectId: string, text: string, mapping?: ColumnMapping) {
  await verifySession();
  const { items } = await matchImportRows(projectId, text, mapping);
  return { ok: true as const, items };
}

/**
 * Importe un tableau de retours client collé depuis un tableur : crée les
 * nouvelles lignes, met à jour l'état de celles déjà importées, ignore le reste,
 * le tout en une transaction.
 */
export async function importFeedback(projectId: string, input: ImportInput) {
  const { userId } = await verifySession();
  try {
    const result = await runImport(projectId, userId, input);
    refresh();
    return { ok: true as const, ...result };
  } catch (error) {
    if (error instanceof ImportError) return { error: error.message };
    // Deux imports simultanés des mêmes lignes : l'unicité (projet, clé) protège des doublons.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Ces retours viennent d’être importés. Actualisez la page pour les voir." };
    }
    throw error;
  }
}
