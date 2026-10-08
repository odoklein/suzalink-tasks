import type { ActivityType, TaskStatus } from "@prisma/client";

import { TASK_STATUSES } from "./constants";

/**
 * Les lignes d'activité écrites avant P4-01 n'ont qu'un `message`. Ce module
 * en déduit le type (et le statut d'arrivée) pour le script de rattrapage
 * `prisma/scripts/backfill-activity-types.ts`. Module pur, testé.
 */

export type LegacyClassification = { type: ActivityType; toStatus?: TaskStatus };

const STATUS_BY_LABEL = new Map<string, TaskStatus>(TASK_STATUSES.map((s) => [s.label, s.value]));

/** Espaces fines et insécables ramenées à une espace simple : les anciens messages en contiennent peu, les nouveaux davantage. */
const flat = (text: string) => text.replace(/[  ]/g, " ");

export function classifyLegacyActivity(message: string): LegacyClassification | null {
  const text = flat(message).trim();

  const moved = /^a passé \S+ en « (.+) »$/.exec(text);
  if (moved) {
    const toStatus = STATUS_BY_LABEL.get(moved[1]);
    return toStatus ? { type: "STATUS_CHANGED", toStatus } : { type: "STATUS_CHANGED" };
  }
  if (/^a réassigné /.test(text)) return { type: "ASSIGNED" };
  if (/^a commenté /.test(text)) return { type: "COMMENTED" };
  if (/^a supprimé \S+ « /.test(text)) return { type: "TASK_DELETED" };
  if (/^a créé le projet$/.test(text)) return { type: "PROJECT_UPDATED" };
  if (/^a créé \S+ « /.test(text)) return { type: "TASK_CREATED" };
  if (/^a importé \d+ retours?/.test(text)) return { type: "IMPORTED" };
  if (/^a enregistré une mise en ligne/.test(text)) return { type: "DELIVERED" };
  if (/^a changé le statut du projet$/.test(text)) return { type: "PROJECT_UPDATED" };
  if (/^a mis à jour le point d['’]étape$/.test(text)) return { type: "PROJECT_UPDATED" };
  return null;
}
