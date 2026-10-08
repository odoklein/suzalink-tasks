"use server";

import { Prisma, type Priority, type TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { safe } from "@/lib/action";
import { logActivities, logActivity } from "@/lib/activity";
import type { Person } from "@/lib/activity-copy";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { changedFields } from "@/lib/events";
import type { ColumnMapping } from "@/lib/feedback-import";
import { ImportError, matchImportRows, runImport, type ImportInput } from "@/lib/import-feedback";
import { waitingSinceFor } from "@/lib/metrics";
import { parseQuickAdd } from "@/lib/quick-add";
import { webActor } from "@/lib/services/core";
import { emitEvent } from "@/lib/services/outbox";
import { diffTask } from "@/lib/task-changes";
import { fromParisDateInput, nowParis } from "@/lib/time";
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/validate";
import { ensureZone } from "@/lib/zones";

const TITLE_TOO_LONG = `Titre trop long (${TITLE_MAX} caractères au plus).`;
const DESCRIPTION_TOO_LONG = `Description trop longue (${DESCRIPTION_MAX} caractères au plus).`;

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "WAITING_CLIENT", "REVIEW", "DONE"];
const PRIORITIES: Priority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];

function refresh() {
  revalidatePath("/", "layout");
}

async function nextPosition(client: Pick<Prisma.TransactionClient, "task">, projectId: string, status: TaskStatus) {
  const last = await client.task.findFirst({
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
  return db.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: input.projectId },
      data: { taskCounter: { increment: 1 } },
      select: { taskCounter: true, key: true },
    });
    const position = await nextPosition(tx, input.projectId, status);
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
    await emitEvent(tx, webActor(creatorId), {
      type: "task.created",
      projectId: input.projectId,
      taskId: task.id,
      payload: { ref, title: task.title, status: task.status, assigneeId: task.assigneeId },
    });
    return { task, ref };
  });
}

export type QuickAddOptions = {
  roundId?: string | null;
  resolvedAssigneeId?: string | null;
};

/** Saisie rapide depuis un projet ou depuis « Aujourd'hui ». */
export async function quickAddTask(
  projectId: string,
  input: string,
  status?: TaskStatus,
  optionsOrAssigneeId?: string | QuickAddOptions,
) {
  return safe(async () => {
    const { userId } = await verifySession();
    // Même ordre que l'aperçu côté client (getTeam) : le résultat ne dépend pas de l'ordre de la base.
    const team = await db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
    const parsed = parseQuickAdd(input, team, nowParis());
    if (!parsed.title) return { error: "Donnez un titre à la tâche." };
    if (parsed.title.length > TITLE_MAX) return { error: TITLE_TOO_LONG };

    const resolvedAssigneeId =
      typeof optionsOrAssigneeId === "string"
        ? optionsOrAssigneeId
        : optionsOrAssigneeId?.resolvedAssigneeId;

    const roundId =
      typeof optionsOrAssigneeId === "object" && optionsOrAssigneeId !== null
        ? optionsOrAssigneeId.roundId
        : undefined;

    // Ajout à un lot de retours ouvert (P4-06) : la tâche hérite de son libellé comme source.
    const round = roundId
      ? await db.feedbackRound.findFirst({
          where: { id: roundId, projectId, status: "OPEN" },
          select: { id: true, label: true },
        })
      : null;

    // Le client envoie la personne qu'il a résolue pour l'aperçu ; on la garde si elle existe, sinon on se fie à l'analyse serveur.
    const assigneeId =
      resolvedAssigneeId && team.some((member) => member.id === resolvedAssigneeId)
        ? resolvedAssigneeId
        : parsed.assigneeId;

    const { task, ref } = await insertTask(
      {
        projectId,
        title: parsed.title,
        status: status && STATUSES.includes(status) ? status : "TODO",
        priority: parsed.priority,
        zone: parsed.zone,
        billable: parsed.billable,
        estimatedAmountCents: parsed.amountCents ?? null,
        assigneeId: assigneeId ?? null,
        dueDate: parsed.dueDate ?? null,
        roundId: round?.id ?? null,
        source: round?.label,
      },
      userId,
    );
    refresh();
    return { ok: true as const, ref, id: task.id };
  });
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
  return safe(async () => {
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
      if (title.length > TITLE_MAX) return { error: TITLE_TOO_LONG };
      data.title = title;
    }
    if (patch.description !== undefined) {
      const description = patch.description?.trim() || null;
      if (description && description.length > DESCRIPTION_MAX) return { error: DESCRIPTION_TOO_LONG };
      data.description = description;
    }
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
    if (patch.dueDate !== undefined) {
      // Un champ date (« yyyy-MM-dd ») vaut minuit à Paris, comme les échéances de la saisie rapide.
      const due = patch.dueDate ? fromParisDateInput(patch.dueDate) : null;
      if (due && Number.isNaN(due.getTime())) return { error: "Date d’échéance invalide." };
      data.dueDate = due;
    }
    const statusChanged = patch.status !== undefined && STATUSES.includes(patch.status) && patch.status !== current.status;
    if (statusChanged && patch.status) {
      data.status = patch.status;
      data.statusChangedAt = new Date();
      data.waitingSince = waitingSinceFor(current.status, patch.status, new Date(), current.waitingSince);
      if (patch.status !== "WAITING_CLIENT") Object.assign(data, { waitingFor: null, followUpAt: null });
      data.position = await nextPosition(db, current.projectId, patch.status);
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

      const base = { projectId: current.projectId, taskId };
      if (statusChanged && patch.status) {
        await emitEvent(tx, webActor(userId), {
          ...base,
          type: "task.status_changed",
          payload: { ref, title: updated.title, from: current.status, to: patch.status },
        });
      }
      if (data.assigneeId !== undefined && data.assigneeId !== current.assigneeId) {
        await emitEvent(tx, webActor(userId), {
          ...base,
          type: "task.assigned",
          payload: { ref, title: updated.title, from: current.assigneeId, to: (data.assigneeId as string | null) ?? null },
        });
      }
      const fields = changedFields(current, data);
      if (fields.length > 0) {
        await emitEvent(tx, webActor(userId), { ...base, type: "task.updated", payload: { ref, title: updated.title, fields } });
      }
    });
    refresh();
    return { ok: true as const };
  });
}

/** Glisser-déposer sur le tableau : nouvelle colonne et nouvelle position. */
export async function moveTask(taskId: string, status: TaskStatus, position: number) {
  return safe(async () => {
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
      const ref = `${current.project.key}-${current.number}`;
      if (status !== current.status) {
        await logActivity(tx, {
          projectId: current.projectId,
          taskId,
          actorId: userId,
          event: { type: "STATUS_CHANGED", ref, from: current.status, to: status },
        });
        await emitEvent(tx, webActor(userId), {
          type: "task.status_changed",
          projectId: current.projectId,
          taskId,
          payload: { ref, title: current.title, from: current.status, to: status },
        });
      }
    });
    refresh();
    return { ok: true as const };
  });
}

export async function deleteTask(taskId: string) {
  return safe(async () => {
    const { userId } = await verifySession();
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { key: true } } },
    });
    if (!task) return { error: "Tâche introuvable." };
    const ref = `${task.project.key}-${task.number}`;
    // Pas de taskId : la ligne d'activité doit survivre à la tâche (cascade sinon).
    await db.$transaction(async (tx) => {
      await tx.task.delete({ where: { id: taskId } });
      await logActivity(tx, {
        projectId: task.projectId,
        actorId: userId,
        event: { type: "TASK_DELETED", ref, title: task.title },
      });
      await emitEvent(tx, webActor(userId), {
        type: "task.deleted",
        projectId: task.projectId,
        taskId,
        payload: { ref, title: task.title },
      });
    });
    refresh();
    return { ok: true as const };
  });
}

function loadTaskDetail(taskId: string) {
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

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof loadTaskDetail>>>;

export async function getTaskDetail(taskId: string) {
  return safe(async () => {
    await verifySession();
    return loadTaskDetail(taskId);
  });
}

export async function addComment(taskId: string, body: string) {
  return safe(async () => {
    const { userId } = await verifySession();
    const text = body.trim();
    if (!text) return { error: "Le commentaire est vide." };
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { key: true } } },
    });
    if (!task) return { error: "Tâche introuvable." };
    const ref = `${task.project.key}-${task.number}`;
    await db.$transaction(async (tx) => {
      const comment = await tx.comment.create({ data: { taskId, authorId: userId, body: text } });
      await logActivity(tx, {
        projectId: task.projectId,
        taskId,
        actorId: userId,
        event: { type: "COMMENTED", ref },
      });
      await emitEvent(tx, webActor(userId), {
        type: "comment.created",
        projectId: task.projectId,
        taskId,
        payload: { ref, commentId: comment.id, excerpt: text.slice(0, 100) },
      });
    });
    refresh();
    return { ok: true as const };
  });
}

/**
 * Aperçu d'un import : pour chaque ligne collée, la tâche existante portant la
 * même clé de déduplication (null si la ligne est nouvelle).
 */
export async function previewImport(projectId: string, text: string, mapping?: ColumnMapping) {
  return safe(async () => {
    await verifySession();
    const { items } = await matchImportRows(projectId, text, mapping);
    return { ok: true as const, items };
  });
}

/**
 * Importe un tableau de retours client collé depuis un tableur : crée les
 * nouvelles lignes, met à jour l'état de celles déjà importées, ignore le reste,
 * le tout en une transaction.
 */
export async function importFeedback(projectId: string, input: ImportInput) {
  return safe(async () => {
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
  });
}
