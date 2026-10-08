import type { TaskStatus } from "@prisma/client";

import { STATUS_BY_VALUE } from "@/lib/constants";
import { plural } from "@/lib/plural";

/**
 * Plan d'import d'un tableau de retours (P4-03) : pour chaque ligne collée,
 * est-elle nouvelle, déjà importée (même clé de déduplication) ou en double
 * dans le collage ? Que propose-t-on par défaut ? Module pur, partagé par
 * l'aperçu (client) et l'action serveur.
 */

export type ExistingMatch = { id: string; ref: string; status: TaskStatus; title: string };

export type RowClassification =
  | { kind: "new" }
  | { kind: "existing"; match: ExistingMatch; statusChanged: boolean }
  | { kind: "paste-duplicate"; ofIndex: number };

/**
 * - `create` : nouvelle tâche (clé de déduplication posée) ;
 * - `update` : met à jour l'état de la tâche existante ;
 * - `skip` : ignorée ;
 * - `force` : crée quand même (sans clé, pour ne pas violer l'unicité).
 */
export type ImportMode = "create" | "update" | "skip" | "force";

/** Classe chaque ligne ; `existingByKey` vient de la base (clé de déduplication → tâche). */
export function classifyRows(
  rows: { key: string; status: TaskStatus }[],
  existingByKey: ReadonlyMap<string, ExistingMatch>,
): RowClassification[] {
  const firstSeen = new Map<string, number>();
  return rows.map((row, index) => {
    const match = existingByKey.get(row.key);
    if (match) return { kind: "existing", match, statusChanged: match.status !== row.status };
    const earlier = firstSeen.get(row.key);
    if (earlier !== undefined) return { kind: "paste-duplicate", ofIndex: earlier };
    firstSeen.set(row.key, index);
    return { kind: "new" };
  });
}

/** Choix par défaut : créer le neuf, mettre à jour si l'état a changé, ignorer le reste. */
export function defaultMode(classification: RowClassification): ImportMode {
  switch (classification.kind) {
    case "new":
      return "create";
    case "existing":
      return classification.statusChanged ? "update" : "skip";
    case "paste-duplicate":
      return "skip";
  }
}

/** Modes proposés dans la liste déroulante d'une ligne. */
export function modesFor(classification: RowClassification): ImportMode[] {
  switch (classification.kind) {
    case "new":
      return ["create", "skip"];
    case "existing":
      return ["update", "skip", "force"];
    case "paste-duplicate":
      return ["skip", "force"];
  }
}

/**
 * Un mode demandé n'est valable que pour une ligne qui le permet ; sinon on
 * retombe sur « ignorer » (jamais de doublon silencieux).
 */
export function resolveMode(requested: ImportMode | undefined, classification: RowClassification): ImportMode {
  if (!requested) return defaultMode(classification);
  return modesFor(classification).includes(requested) ? requested : "skip";
}

export type PlanCounts = { create: number; update: number; skip: number };

export function countModes(modes: ImportMode[]): PlanCounts {
  const counts: PlanCounts = { create: 0, update: 0, skip: 0 };
  for (const mode of modes) {
    if (mode === "create" || mode === "force") counts.create++;
    else if (mode === "update") counts.update++;
    else counts.skip++;
  }
  return counts;
}

/** « Créer 18 tâches · mettre à jour 4 » */
export function importButtonLabel({ create, update }: PlanCounts): string {
  const parts: string[] = [];
  if (create > 0) parts.push(`Créer ${plural(create, "tâche")}`);
  if (update > 0) parts.push(`${parts.length ? "mettre" : "Mettre"} à jour ${update}`);
  if (parts.length === 0) return "Rien à importer";
  return parts.join(" · ");
}

/** Texte du badge d'une ligne. */
export function classificationLabel(classification: RowClassification, rowStatus: TaskStatus): string {
  switch (classification.kind) {
    case "new":
      return "Nouvelle";
    case "existing":
      return classification.statusChanged
        ? `État modifié : ${STATUS_BY_VALUE[classification.match.status].short} → ${STATUS_BY_VALUE[rowStatus].short}`
        : `Déjà importée (${classification.match.ref})`;
    case "paste-duplicate":
      return "Doublon dans le collage";
  }
}
