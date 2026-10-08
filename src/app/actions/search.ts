"use server";

import type { TaskStatus } from "@prisma/client";

import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { rankSearchResults } from "@/lib/search";
import { parseTaskRef } from "@/lib/task-ref";

export type TaskSearchResult = {
  id: string;
  ref: string;
  title: string;
  status: TaskStatus;
  zone: string | null;
  project: { name: string; key: string; color: string; slug: string };
};

const LIMIT = 20;

const select = {
  id: true,
  number: true,
  title: true,
  status: true,
  zone: true,
  source: true,
  project: { select: { name: true, key: true, color: true, slug: true } },
} as const;

type Row = { id: string; number: number; title: string; status: TaskStatus; zone: string | null; source: string | null; project: TaskSearchResult["project"] };

const toResult = (row: Row): TaskSearchResult => ({
  id: row.id,
  ref: `${row.project.key}-${row.number}`,
  title: row.title,
  status: row.status,
  zone: row.zone,
  project: row.project,
});

/**
 * Recherche de tâches pour la palette.
 * - « BG-12 » : recherche exacte par référence.
 * - Sinon : contient (insensible à la casse) dans le titre, la page, la source ou le nom du
 *   projet, projets archivés exclus, 20 résultats. Si l’extension pg_trgm est installée
 *   (prisma/sql/search-trgm.sql, étape manuelle), les résultats sont triés par similarité ;
 *   sinon un classement simple côté serveur (préfixe, mot entier) s’applique.
 */
export async function searchTasks(query: string): Promise<TaskSearchResult[]> {
  await verifySession();
  const q = query.trim().slice(0, 120);
  if (q.length < 2) return [];

  const ref = parseTaskRef(q);
  if (ref) {
    const task = await db.task.findFirst({
      where: { number: ref.number, project: { key: ref.key } },
      select,
    });
    if (task) return [toResult(task)];
  }

  const contains = { contains: q, mode: "insensitive" as const };
  const rows = await db.task.findMany({
    where: {
      project: { archived: false },
      OR: [{ title: contains }, { zone: contains }, { source: contains }, { project: { name: contains } }],
    },
    select,
    take: 60,
    orderBy: { updatedAt: "desc" },
  });

  const order = await similarityOrder(q, rows.map((row) => row.id));
  const ranked = order
    ? [...rows].sort((a, b) => (order.get(b.id) ?? 0) - (order.get(a.id) ?? 0))
    : rankSearchResults(q, rows, (row) => [row.title, row.zone, row.source, row.project.name]);
  return ranked.slice(0, LIMIT).map(toResult);
}

/** Similarité trigramme (pg_trgm) ; null si l’extension n’est pas disponible. */
async function similarityOrder(q: string, ids: string[]): Promise<Map<string, number> | null> {
  if (ids.length === 0) return new Map();
  try {
    const rows = await db.$queryRaw<{ id: string; score: number }[]>`
      SELECT id, similarity(title, ${q}) AS score FROM "Task" WHERE id = ANY(${ids})`;
    return new Map(rows.map((row) => [row.id, Number(row.score)]));
  } catch {
    return null;
  }
}
