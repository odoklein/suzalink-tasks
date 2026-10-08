"use server";

import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { parseTaskRef } from "@/lib/task-ref";

/**
 * Retrouve une tâche à partir de sa référence (« BG-12 ») ou de son id.
 * Sert au tiroir quand l’URL porte ?tache=… (lien collé, rechargement de la page).
 */
export async function resolveTaskRef(value: string): Promise<{ id: string; ref: string; slug: string } | null> {
  await verifySession();
  const parsed = parseTaskRef(value);
  const task = parsed
    ? await db.task.findFirst({
        where: { number: parsed.number, project: { key: parsed.key } },
        select: { id: true, number: true, project: { select: { key: true, slug: true } } },
      })
    : await db.task.findUnique({
        where: { id: value },
        select: { id: true, number: true, project: { select: { key: true, slug: true } } },
      });
  if (!task) return null;
  return { id: task.id, ref: `${task.project.key}-${task.number}`, slug: task.project.slug };
}
