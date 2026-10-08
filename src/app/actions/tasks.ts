"use server";

import type { Priority, TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { STATUS_BY_VALUE } from "@/lib/constants";
import { safe } from "@/lib/action";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { parseFeedbackTable } from "@/lib/feedback-import";
import { parseQuickAdd } from "@/lib/quick-add";

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "WAITING_CLIENT", "REVIEW", "DONE"];
const PRIORITIES: Priority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];

function refresh() {
  revalidatePath("/", "layout");
}

async function log(projectId: string, actorId: string, message: string, taskId?: string) {
  await db.activity.create({ data: { projectId, actorId, message, taskId } });
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
  assigneeId?: string | null;
  dueDate?: Date | null;
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
        assigneeId: input.assigneeId ?? null,
        dueDate: input.dueDate ?? null,
        creatorId,
        position,
        completedAt: status === "DONE" ? new Date() : null,
      },
    });
    return { task, ref: `${project.key}-${task.number}` };
  });
}

/** Saisie rapide depuis un projet ou depuis « Aujourd'hui ». */
export async function quickAddTask(projectId: string, input: string, status?: TaskStatus) {
  return safe(async () => {
    const { userId } = await verifySession();
    const team = await db.user.findMany({ select: { id: true, name: true } });
    const parsed = parseQuickAdd(input, team);
    if (!parsed.title) return { error: "Donnez un titre à la tâche." };

    const { ref } = await insertTask(
      {
        projectId,
        title: parsed.title,
        status: status && STATUSES.includes(status) ? status : "TODO",
        priority: parsed.priority,
        zone: parsed.zone,
        billable: parsed.billable,
        assigneeId: parsed.assigneeId ?? null,
        dueDate: parsed.dueDate ?? null,
      },
      userId,
    );
    await log(projectId, userId, `a créé ${ref} « ${parsed.title} »`);
    refresh();
    return { ok: true as const, ref };
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
      data.title = title;
    }
    if (patch.description !== undefined) data.description = patch.description?.trim() || null;
    if (patch.priority !== undefined && PRIORITIES.includes(patch.priority)) data.priority = patch.priority;
    if (patch.zone !== undefined) data.zone = patch.zone?.trim() || null;
    if (patch.source !== undefined) data.source = patch.source?.trim() || null;
    if (patch.billable !== undefined) data.billable = patch.billable;
    if (patch.assigneeId !== undefined) data.assigneeId = patch.assigneeId || null;
    if (patch.dueDate !== undefined) data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
    if (patch.status !== undefined && STATUSES.includes(patch.status) && patch.status !== current.status) {
      data.status = patch.status;
      data.statusChangedAt = new Date();
      data.position = await nextPosition(current.projectId, patch.status);
      data.completedAt = patch.status === "DONE" ? new Date() : null;
    }

    await db.task.update({ where: { id: taskId }, data });

    const ref = `${current.project.key}-${current.number}`;
    if (data.status) {
      await log(current.projectId, userId, `a passé ${ref} en « ${STATUS_BY_VALUE[data.status as TaskStatus].label} »`, taskId);
    } else if (data.assigneeId !== undefined && data.assigneeId !== current.assigneeId) {
      await log(current.projectId, userId, `a réassigné ${ref}`, taskId);
    }
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

    await db.task.update({
      where: { id: taskId },
      data: {
        status,
        position,
        completedAt: status === "DONE" ? (current.completedAt ?? new Date()) : null,
        ...(status !== current.status ? { statusChangedAt: new Date() } : {}),
      },
    });
    if (status !== current.status) {
      await log(
        current.projectId,
        userId,
        `a passé ${current.project.key}-${current.number} en « ${STATUS_BY_VALUE[status].label} »`,
        taskId,
      );
    }
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
    await db.task.delete({ where: { id: taskId } });
    await log(task.projectId, userId, `a supprimé ${task.project.key}-${task.number} « ${task.title} »`);
    refresh();
    return { ok: true as const };
  });
}

/** Le détail vient d’une requête interne : `getTaskDetail` renvoie `{ error }` si la base est indisponible. */
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

export async function getTaskDetail(taskId: string) {
  return safe(async () => {
    await verifySession();
    return loadTaskDetail(taskId);
  });
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof loadTaskDetail>>>;

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
    await db.comment.create({ data: { taskId, authorId: userId, body: text } });
    await log(task.projectId, userId, `a commenté ${task.project.key}-${task.number}`, taskId);
    refresh();
    return { ok: true as const };
  });
}

/** Importe un tableau de retours client collé depuis un tableur. */
export async function importFeedback(projectId: string, text: string, sourceLabel: string) {
  return safe(async () => {
    const { userId } = await verifySession();
    const rows = parseFeedbackTable(text);
    if (rows.length === 0) {
      return { error: "Aucune ligne reconnue. Copiez les cellules du tableau, en-têtes compris." };
    }

    for (const row of rows) {
      await insertTask(
        {
          projectId,
          title: row.title,
          description: row.description,
          zone: row.zone,
          status: row.status,
          source: sourceLabel.trim() || (row.date ? `Retours du ${row.date}` : "Retours client"),
        },
        userId,
      );
    }
    await log(projectId, userId, `a importé ${rows.length} retours (${sourceLabel.trim() || "retours client"})`);
    refresh();
    return { ok: true as const, count: rows.length };
  });
}
