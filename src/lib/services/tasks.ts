import "server-only";

import type { TaskStatus } from "@prisma/client";

import { STATUS_BY_VALUE } from "@/lib/constants";
import { db } from "@/lib/db";
import { parseFeedbackTable } from "@/lib/feedback-import";
import { parseQuickAdd } from "@/lib/quick-add";
import { logActivity } from "@/lib/services/activity";
import { parseInput, parseTaskRef, ServiceError, taskRef, type Actor, type Tx } from "@/lib/services/core";
import {
  moveTaskSchema,
  newTaskSchema,
  taskPatchSchema,
  taskStatusSchema,
  type NewTaskInput,
  type TaskPatchInput,
} from "@/lib/validation";

const POSITION_STEP = 1000;

async function nextPosition(tx: Tx, projectId: string, status: TaskStatus) {
  const last = await tx.task.findFirst({
    where: { projectId, status },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? 0) + POSITION_STEP;
}

async function requireTask(tx: Tx, taskId: string) {
  const task = await tx.task.findUnique({
    where: { id: taskId },
    include: { project: { select: { key: true } } },
  });
  if (!task) throw new ServiceError("Tâche introuvable.", "NOT_FOUND");
  return task;
}

/** Crée une tâche (numéro et position attribués dans la même transaction). */
export async function createTask(actor: Actor, raw: NewTaskInput) {
  const input = parseInput(newTaskSchema, raw);
  const status = input.status ?? "TODO";
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
        description: input.description ?? null,
        status,
        priority: input.priority ?? "NONE",
        zone: input.zone ?? null,
        source: input.source ?? null,
        billable: input.billable ?? false,
        assigneeId: input.assigneeId ?? null,
        dueDate: input.dueDate ?? null,
        creatorId: actor.userId,
        position: await nextPosition(tx, input.projectId, status),
        completedAt: status === "DONE" ? new Date() : null,
      },
    });
    const ref = taskRef(project.key, task.number);
    await logActivity(tx, { projectId: input.projectId, actorId: actor.userId, message: `a créé ${ref} « ${task.title} »` });
    return { task, ref };
  });
}

/**
 * Crée plusieurs tâches d'un coup, dans une seule transaction : numéros
 * contigus, positions en fin de colonne, une seule ligne d'activité.
 * (Même logique que P1-10 : à garder ici à la fusion.)
 */
export async function createTasks(
  actor: Actor,
  projectId: string,
  rawTasks: Omit<NewTaskInput, "projectId">[],
  options: { activityMessage?: string } = {},
) {
  const inputs = rawTasks.map((task) => parseInput(newTaskSchema, { ...task, projectId }));
  if (inputs.length === 0) return { tasks: [], refs: [] as string[] };

  return db.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: projectId },
      data: { taskCounter: { increment: inputs.length } },
      select: { taskCounter: true, key: true },
    });
    const start = project.taskCounter - inputs.length + 1;

    const tops = await tx.task.groupBy({ by: ["status"], where: { projectId }, _max: { position: true } });
    const nextByStatus = new Map<TaskStatus, number>(tops.map((top) => [top.status, top._max.position ?? 0]));
    const now = new Date();

    const tasks = await tx.task.createManyAndReturn({
      data: inputs.map((input, index) => {
        const status = input.status ?? "TODO";
        const position = (nextByStatus.get(status) ?? 0) + POSITION_STEP;
        nextByStatus.set(status, position);
        return {
          projectId,
          number: start + index,
          title: input.title,
          description: input.description ?? null,
          status,
          priority: input.priority ?? "NONE",
          zone: input.zone ?? null,
          source: input.source ?? null,
          billable: input.billable ?? false,
          assigneeId: input.assigneeId ?? null,
          dueDate: input.dueDate ?? null,
          creatorId: actor.userId,
          position,
          completedAt: status === "DONE" ? now : null,
        };
      }),
    });
    tasks.sort((a, b) => a.number - b.number);

    await logActivity(tx, {
      projectId,
      actorId: actor.userId,
      message: options.activityMessage ?? `a créé ${tasks.length} tâche${tasks.length > 1 ? "s" : ""}`,
    });
    return { tasks, refs: tasks.map((task) => taskRef(project.key, task.number)) };
  });
}

/** Saisie rapide : `Retirer l'ombre @odo !haute #homepage demain $`. */
export async function quickAddTask(actor: Actor, projectId: string, input: string, status?: TaskStatus) {
  const team = await db.user.findMany({ select: { id: true, name: true } });
  const parsed = parseQuickAdd(input, team);
  if (!parsed.title) throw new ServiceError("Donnez un titre à la tâche.");
  const safeStatus = status && taskStatusSchema.safeParse(status).success ? status : "TODO";
  return createTask(actor, {
    projectId,
    title: parsed.title,
    status: safeStatus,
    priority: parsed.priority,
    zone: parsed.zone,
    billable: parsed.billable,
    assigneeId: parsed.assigneeId ?? null,
    dueDate: parsed.dueDate ?? null,
  });
}

/** Met à jour les champs d'une tâche ; le changement de statut la place en fin de colonne. */
export async function updateTask(actor: Actor, taskId: string, rawPatch: TaskPatchInput) {
  const patch = parseInput(taskPatchSchema, rawPatch);
  return db.$transaction(async (tx) => {
    const current = await requireTask(tx, taskId);
    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.priority !== undefined) data.priority = patch.priority;
    if (patch.zone !== undefined) data.zone = patch.zone;
    if (patch.source !== undefined) data.source = patch.source;
    if (patch.billable !== undefined) data.billable = patch.billable;
    if (patch.assigneeId !== undefined) data.assigneeId = patch.assigneeId;
    if (patch.dueDate !== undefined) data.dueDate = patch.dueDate ? new Date(patch.dueDate) : null;
    const statusChanged = patch.status !== undefined && patch.status !== current.status;
    if (statusChanged && patch.status) {
      data.status = patch.status;
      data.statusChangedAt = new Date();
      data.position = await nextPosition(tx, current.projectId, patch.status);
      data.completedAt = patch.status === "DONE" ? new Date() : null;
    }

    const task = await tx.task.update({ where: { id: taskId }, data });

    const ref = taskRef(current.project.key, current.number);
    if (statusChanged && patch.status) {
      await logActivity(tx, {
        projectId: current.projectId,
        actorId: actor.userId,
        taskId,
        message: `a passé ${ref} en « ${STATUS_BY_VALUE[patch.status].label} »`,
      });
    } else if (data.assigneeId !== undefined && data.assigneeId !== current.assigneeId) {
      await logActivity(tx, { projectId: current.projectId, actorId: actor.userId, taskId, message: `a réassigné ${ref}` });
    }
    return { task, ref, previous: current };
  });
}

/** Glisser-déposer : nouvelle colonne et nouvelle position. */
export async function moveTask(actor: Actor, raw: { taskId: string; status: TaskStatus; position: number }) {
  const { taskId, status, position } = parseInput(moveTaskSchema, raw);
  return db.$transaction(async (tx) => {
    const current = await requireTask(tx, taskId);
    const task = await tx.task.update({
      where: { id: taskId },
      data: {
        status,
        position,
        completedAt: status === "DONE" ? (current.completedAt ?? new Date()) : null,
        ...(status !== current.status ? { statusChangedAt: new Date() } : {}),
      },
    });
    const ref = taskRef(current.project.key, current.number);
    if (status !== current.status) {
      await logActivity(tx, {
        projectId: current.projectId,
        actorId: actor.userId,
        taskId,
        message: `a passé ${ref} en « ${STATUS_BY_VALUE[status].label} »`,
      });
    }
    return { task, ref, previous: current };
  });
}

export async function deleteTask(actor: Actor, taskId: string) {
  return db.$transaction(async (tx) => {
    const task = await requireTask(tx, taskId);
    await tx.task.delete({ where: { id: taskId } });
    const ref = taskRef(task.project.key, task.number);
    await logActivity(tx, { projectId: task.projectId, actorId: actor.userId, message: `a supprimé ${ref} « ${task.title} »` });
    return { ref };
  });
}

/** Importe un tableau de retours collé depuis un tableur. */
export async function importFeedback(actor: Actor, projectId: string, text: string, sourceLabel: string) {
  const rows = parseFeedbackTable(text);
  if (rows.length === 0) {
    throw new ServiceError("Aucune ligne reconnue. Copiez les cellules du tableau, en-têtes compris.");
  }
  const label = sourceLabel.trim();
  const { tasks } = await createTasks(
    actor,
    projectId,
    rows.map((row) => ({
      title: row.title,
      description: row.description,
      zone: row.zone,
      status: row.status,
      source: label || (row.date ? `Retours du ${row.date}` : "Retours client"),
    })),
    { activityMessage: `a importé ${rows.length} retours (${label || "retours client"})` },
  );
  return { count: tasks.length };
}

/** Détail d'une tâche pour le tiroir. */
export function getTaskDetail(taskId: string) {
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

/** Retrouve une tâche par sa référence (BG-12). */
export async function findTaskByRef(ref: string) {
  const parsed = parseTaskRef(ref);
  if (!parsed) return null;
  return db.task.findFirst({
    where: { number: parsed.number, project: { key: parsed.key } },
    include: {
      project: { select: { id: true, key: true, name: true, slug: true } },
      assignee: { select: { id: true, name: true } },
    },
  });
}
