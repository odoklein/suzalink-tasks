import "server-only";

import type { TaskStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { parseTaskRef, taskRef } from "@/lib/services/core";

export type TaskSearchResult = {
  id: string;
  ref: string;
  title: string;
  status: TaskStatus;
  zone: string | null;
  project: { id: string; key: string; name: string; slug: string };
};

/**
 * Recherche de tâches : référence exacte (« BG-12 »), sinon texte dans le
 * titre, la page, la source et le nom du projet. La version classée par
 * similarité (pg_trgm) et l'exclusion des tâches supprimées arrivent avec
 * P3-02 / P3-04.
 */
export async function searchTasks(
  query: string,
  options: { limit?: number; projectId?: string; status?: TaskStatus[] } = {},
): Promise<TaskSearchResult[]> {
  const q = query.trim();
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const select = {
    id: true,
    number: true,
    title: true,
    status: true,
    zone: true,
    project: { select: { id: true, key: true, name: true, slug: true } },
  } as const;
  const scope = {
    ...(options.projectId ? { projectId: options.projectId } : {}),
    ...(options.status?.length ? { status: { in: options.status } } : {}),
  };

  const ref = parseTaskRef(q);
  const rows = ref
    ? await db.task.findMany({ where: { ...scope, number: ref.number, project: { key: ref.key } }, select, take: 1 })
    : q
      ? await db.task.findMany({
          where: {
            ...scope,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { zone: { contains: q, mode: "insensitive" } },
              { source: { contains: q, mode: "insensitive" } },
              { project: { name: { contains: q, mode: "insensitive" } } },
            ],
          },
          select,
          orderBy: { updatedAt: "desc" },
          take: limit,
        })
      : [];

  return rows.map((task) => ({
    id: task.id,
    ref: taskRef(task.project.key, task.number),
    title: task.title,
    status: task.status,
    zone: task.zone,
    project: task.project,
  }));
}
