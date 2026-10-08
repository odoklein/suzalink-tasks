import type { Priority, TaskStatus } from "@prisma/client";

import type { ImportedRow } from "@/lib/feedback-import";
import { resolveMode, type ImportMode, type RowClassification } from "@/lib/import-plan";
import { waitingSinceFor } from "@/lib/metrics";

/**
 * Transforme les lignes collées, la classification et les choix de
 * l'utilisateur en écritures à faire (P4-03). Module pur : l'action serveur n'a
 * plus qu'à numéroter et écrire, en une transaction.
 */

export const MAX_IMPORT_ROWS = 500;
const TITLE_MAX = 180;
const POSITION_STEP = 1000;

/** Modifications faites dans le tableau d'aperçu, par numéro de ligne (base 0, hors en-tête). */
export type RowOverride = {
  index: number;
  mode?: ImportMode;
  zone?: string | null;
  status?: TaskStatus;
  title?: string;
};

export type ImportDefaults = {
  assigneeId?: string | null;
  priority?: Priority;
  dueDate?: Date | null;
};

export type CreateDraft = {
  title: string;
  description: string | null;
  zone: string | null;
  status: TaskStatus;
  source: string;
  /** null pour « Créer quand même » : pas de clé, donc pas de conflit d'unicité. */
  externalKey: string | null;
  position: number;
  priority: Priority;
  assigneeId: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  waitingSince: Date | null;
};

export type UpdateDraft = {
  taskId: string;
  ref: string;
  from: TaskStatus;
  to: TaskStatus;
  position: number;
  completedAt: Date | null;
  waitingSince: Date | null;
};

export type ImportWrites = { creates: CreateDraft[]; updates: UpdateDraft[]; skipped: number };

export function planImportWrites(input: {
  rows: ImportedRow[];
  keys: string[];
  classifications: RowClassification[];
  overrides?: RowOverride[];
  /** Plus grande position existante par statut (le projet entier). */
  maxPositions: Partial<Record<TaskStatus, number>>;
  source: string;
  defaults?: ImportDefaults;
  /** Dates de complétion et d'attente actuelles des tâches à mettre à jour. */
  existingState?: ReadonlyMap<string, { completedAt: Date | null; waitingSince: Date | null }>;
  now: Date;
}): ImportWrites {
  const { rows, keys, classifications, maxPositions, source, now } = input;
  const overrides = new Map((input.overrides ?? []).map((override) => [override.index, override]));
  const cursor = new Map<TaskStatus, number>();
  const nextPosition = (status: TaskStatus) => {
    const next = (cursor.get(status) ?? maxPositions[status] ?? 0) + POSITION_STEP;
    cursor.set(status, next);
    return next;
  };

  const creates: CreateDraft[] = [];
  const updates: UpdateDraft[] = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const classification = classifications[index];
    const override = overrides.get(index);
    const mode = resolveMode(override?.mode, classification);

    if (mode === "skip") {
      skipped++;
      return;
    }

    const status = override?.status ?? row.status;

    if (mode === "update") {
      if (classification.kind !== "existing" || classification.match.status === status) {
        skipped++;
        return;
      }
      const { match } = classification;
      const state = input.existingState?.get(match.id);
      updates.push({
        taskId: match.id,
        ref: match.ref,
        from: match.status,
        to: status,
        position: nextPosition(status),
        completedAt: status === "DONE" ? (state?.completedAt ?? now) : null,
        waitingSince: waitingSinceFor(match.status, status, now, state?.waitingSince ?? null),
      });
      return;
    }

    const title = (override?.title ?? row.title).replace(/\s+/g, " ").trim();
    if (!title) {
      skipped++;
      return;
    }
    const zone = override?.zone !== undefined ? override.zone?.trim() || null : (row.zone ?? null);
    creates.push({
      title: title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 3)}…` : title,
      description: row.description ?? null,
      zone,
      status,
      source,
      externalKey: mode === "force" ? null : keys[index],
      position: nextPosition(status),
      priority: input.defaults?.priority ?? "NONE",
      assigneeId: input.defaults?.assigneeId ?? null,
      dueDate: input.defaults?.dueDate ?? null,
      completedAt: status === "DONE" ? now : null,
      waitingSince: status === "WAITING_CLIENT" ? now : null,
    });
  });

  return { creates, updates, skipped };
}
