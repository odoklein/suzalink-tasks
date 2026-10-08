"use server";

import type { Priority, TaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/dal";
import * as comments from "@/lib/services/comments";
import { runService, webActor } from "@/lib/services/core";
import * as tasks from "@/lib/services/tasks";

// Actions minces : session → validation (dans le service, zod) → service → revalidation.

function refresh() {
  revalidatePath("/", "layout");
}

/** Saisie rapide depuis un projet ou depuis « Aujourd'hui ». */
export async function quickAddTask(projectId: string, input: string, status?: TaskStatus) {
  const { userId } = await verifySession();
  return runService(async () => {
    const { ref } = await tasks.quickAddTask(webActor(userId), projectId, input, status);
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
  const { userId } = await verifySession();
  return runService(async () => {
    await tasks.updateTask(webActor(userId), taskId, patch);
    refresh();
    return { ok: true as const };
  });
}

/** Glisser-déposer sur le tableau : nouvelle colonne et nouvelle position. */
export async function moveTask(taskId: string, status: TaskStatus, position: number) {
  const { userId } = await verifySession();
  return runService(async () => {
    await tasks.moveTask(webActor(userId), { taskId, status, position });
    refresh();
    return { ok: true as const };
  });
}

export async function deleteTask(taskId: string) {
  const { userId } = await verifySession();
  return runService(async () => {
    await tasks.deleteTask(webActor(userId), taskId);
    refresh();
    return { ok: true as const };
  });
}

export async function getTaskDetail(taskId: string) {
  await verifySession();
  return tasks.getTaskDetail(taskId);
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

export async function addComment(taskId: string, body: string) {
  const { userId } = await verifySession();
  return runService(async () => {
    await comments.addComment(webActor(userId), { taskId, body });
    refresh();
    return { ok: true as const };
  });
}

/** Importe un tableau de retours client collé depuis un tableur. */
export async function importFeedback(projectId: string, text: string, sourceLabel: string) {
  const { userId } = await verifySession();
  return runService(async () => {
    const { count } = await tasks.importFeedback(webActor(userId), projectId, text, sourceLabel);
    refresh();
    return { ok: true as const, count };
  });
}
