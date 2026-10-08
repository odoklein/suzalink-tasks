import "server-only";

import type { Prisma, Priority, TaskStatus } from "@prisma/client";

import { logActivities, logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import { detectTable, parseFeedbackRows, type ColumnMapping } from "@/lib/feedback-import";
import { importKey } from "@/lib/import-key";
import { classifyRows, type ExistingMatch } from "@/lib/import-plan";
import { MAX_IMPORT_ROWS, planImportWrites, type RowOverride } from "@/lib/import-writes";
import { fromParisDateTimeInput } from "@/lib/time";
import { ensureZones } from "@/lib/zones";

type Tx = Prisma.TransactionClient;

/** Erreur dont le message peut être montré tel quel à l'utilisateur. */
export class ImportError extends Error {}

const PRIORITY_VALUES: Priority[] = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"];

/** Lit le collage avec l'affectation de colonnes demandée (sinon celle détectée). */
export function readImport(text: string, mapping?: ColumnMapping) {
  const detected = detectTable(text);
  const rows = parseFeedbackRows(detected.rows, mapping ?? detected.mapping).slice(0, MAX_IMPORT_ROWS);
  return { rows, keys: rows.map((row) => importKey(row.zone, row.title)), detected };
}

/**
 * Tâches du projet qui correspondent à ces clés. Les tâches importées avant
 * P4-03 n'ont pas encore d'`externalKey` (tant que le rattrapage n'a pas tourné) :
 * celles issues d'un import (source « Retours… ») sont rapprochées en recalculant leur clé.
 */
export async function findExistingByKey(client: Tx, projectId: string, keys: string[]) {
  const tasks = await client.task.findMany({
    where: {
      projectId,
      OR: [{ externalKey: { in: keys } }, { externalKey: null, source: { startsWith: "Retours" } }],
    },
    select: {
      id: true,
      number: true,
      title: true,
      zone: true,
      status: true,
      externalKey: true,
      completedAt: true,
      waitingSince: true,
      project: { select: { key: true } },
    },
    orderBy: { number: "asc" },
  });

  const wanted = new Set(keys);
  const byKey = new Map<string, ExistingMatch>();
  const state = new Map<string, { completedAt: Date | null; waitingSince: Date | null }>();
  for (const task of tasks) {
    const key = task.externalKey ?? importKey(task.zone, task.title);
    if (!wanted.has(key) || byKey.has(key)) continue;
    byKey.set(key, { id: task.id, ref: `${task.project.key}-${task.number}`, status: task.status, title: task.title });
    state.set(task.id, { completedAt: task.completedAt, waitingSince: task.waitingSince });
  }
  return { byKey, state };
}

/** Aperçu : pour chaque ligne collée, la tâche existante qui porte la même clé. */
export async function matchImportRows(projectId: string, text: string, mapping?: ColumnMapping) {
  const { rows, keys } = readImport(text, mapping);
  const { byKey } = await findExistingByKey(db, projectId, keys);
  return { count: rows.length, items: keys.map((key) => ({ key, match: byKey.get(key) ?? null })) };
}

export type ImportInput = {
  text: string;
  mapping?: ColumnMapping;
  source: string;
  rows?: RowOverride[];
  assigneeId?: string | null;
  priority?: Priority;
  /** `yyyy-MM-dd`, minuit à Paris. */
  dueDate?: string | null;
  /** Date de réception du lot (colonne Date du tableau), ISO. */
  receivedAt?: string | null;
  /** « De la part de » : contact du client. */
  fromContactId?: string | null;
};

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  taskIds: string[];
  source: string;
  roundId: string | null;
};

/**
 * Importe un tableau de retours en une seule transaction :
 * 1. une incrémentation du compteur du projet (numéros contigus) ;
 * 2. une lecture des positions maximales par statut ;
 * 3. un `createMany` pour les nouvelles tâches, un `update` par changement d'état ;
 * 4. une ligne d'activité « a importé N retours » (+ une par changement d'état).
 */
export async function runImport(projectId: string, userId: string, input: ImportInput): Promise<ImportResult> {
  const { rows, keys } = readImport(input.text, input.mapping);
  if (rows.length === 0) throw new ImportError("Aucune ligne reconnue. Copiez les cellules du tableau, en-têtes compris.");

  const now = new Date();
  const source = input.source.trim() || "Retours client";
  const priority = input.priority && PRIORITY_VALUES.includes(input.priority) ? input.priority : undefined;
  const due = input.dueDate ? fromParisDateTimeInput(`${input.dueDate}T00:00`) : null;
  if (due && Number.isNaN(due.getTime())) throw new ImportError("Échéance invalide.");

  return db.$transaction(async (tx) => {
    const { byKey, state } = await findExistingByKey(tx, projectId, keys);
    const classifications = classifyRows(
      rows.map((row, index) => ({ key: keys[index], status: row.status })),
      byKey,
    );

    let assigneeId: string | null = null;
    if (input.assigneeId) {
      const user = await tx.user.findUnique({ where: { id: input.assigneeId }, select: { id: true } });
      if (!user) throw new ImportError("Membre introuvable.");
      assigneeId = user.id;
    }

    const grouped = await tx.task.groupBy({ by: ["status"], where: { projectId }, _max: { position: true } });
    const maxPositions: Partial<Record<TaskStatus, number>> = {};
    for (const group of grouped) maxPositions[group.status] = group._max.position ?? 0;

    const writes = planImportWrites({
      rows,
      keys,
      classifications,
      overrides: input.rows,
      maxPositions,
      source,
      defaults: { assigneeId, priority, dueDate: due },
      existingState: state,
      now,
    });

    // Chaque import crée un lot de retours qui garde le collage d'origine comme preuve.
    let roundId: string | null = null;
    if (writes.creates.length > 0 || writes.updates.length > 0) {
      const received = input.receivedAt ? new Date(input.receivedAt) : now;
      const fromContact = input.fromContactId
        ? await tx.contact.findUnique({ where: { id: input.fromContactId }, select: { id: true } })
        : null;
      const round = await tx.feedbackRound.create({
        data: {
          projectId,
          label: source,
          receivedAt: Number.isNaN(received.getTime()) ? now : received,
          channel: "SHEETS",
          rawText: input.text.slice(0, 200_000),
          fromContactId: fromContact?.id ?? null,
        },
        select: { id: true },
      });
      roundId = round.id;
    }

    let taskIds: string[] = [];
    if (writes.creates.length > 0) {
      const count = writes.creates.length;
      const project = await tx.project.update({
        where: { id: projectId },
        data: { taskCounter: { increment: count } },
        select: { taskCounter: true },
      });
      const first = project.taskCounter - count + 1;
      const zoneIds = await ensureZones(tx, projectId, writes.creates.map((draft) => draft.zone));
      await tx.task.createMany({
        data: writes.creates.map((draft, offset) => ({
          projectId,
          number: first + offset,
          creatorId: userId,
          title: draft.title,
          description: draft.description,
          zone: draft.zone,
          status: draft.status,
          source: draft.source,
          externalKey: draft.externalKey,
          position: draft.position,
          priority: draft.priority,
          assigneeId: draft.assigneeId,
          dueDate: draft.dueDate,
          completedAt: draft.completedAt,
          waitingSince: draft.waitingSince,
          statusChangedAt: now,
          roundId,
          zoneId: draft.zone ? (zoneIds.get(draft.zone) ?? null) : null,
        })),
      });
      const created = await tx.task.findMany({
        where: { projectId, number: { gte: first, lt: first + count } },
        select: { id: true },
        orderBy: { number: "asc" },
      });
      taskIds = created.map((task) => task.id);
    }

    for (const update of writes.updates) {
      await tx.task.update({
        where: { id: update.taskId },
        data: {
          status: update.to,
          statusChangedAt: now,
          position: update.position,
          completedAt: update.completedAt,
          waitingSince: update.waitingSince,
        },
      });
    }
    await logActivities(
      tx,
      writes.updates.map((update) => ({
        projectId,
        taskId: update.taskId,
        actorId: userId,
        event: { type: "STATUS_CHANGED" as const, ref: update.ref, from: update.from, to: update.to },
      })),
    );
    if (writes.creates.length > 0 || writes.updates.length > 0) {
      await logActivity(tx, {
        projectId,
        actorId: userId,
        event: { type: "IMPORTED", created: writes.creates.length, updated: writes.updates.length, source },
      });
    }

    return {
      created: writes.creates.length,
      updated: writes.updates.length,
      skipped: writes.skipped,
      taskIds,
      source,
      roundId,
    };
  });
}
