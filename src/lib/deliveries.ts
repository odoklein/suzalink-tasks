import type { RoundStatus, TaskStatus } from "@prisma/client";

/**
 * Contenu d'une mise en ligne (P4-07) : tâches proposées, titre suggéré, lots
 * de retours qu'elle peut clôturer. Module pur.
 */

export type CandidateTask = {
  id: string;
  status: TaskStatus;
  completedAt: Date | null;
  zone: string | null;
  roundId?: string | null;
};

/**
 * Tâches à cocher par défaut : « À valider », et « Fait » depuis la mise en
 * ligne précédente (toutes si c'est la première).
 */
export function deliveryCandidates<T extends CandidateTask>(tasks: T[], previousDeliveryAt: Date | null): T[] {
  return tasks.filter((task) => {
    if (task.status === "REVIEW") return true;
    if (task.status !== "DONE") return false;
    if (!previousDeliveryAt) return true;
    return !!task.completedAt && task.completedAt > previousDeliveryAt;
  });
}

/** « Corrections Homepage, Fiche produit » ; au-delà de 3 pages : « Corrections Homepage, Contact et 2 autres pages ». */
export function suggestDeliveryTitle(zones: (string | null)[]): string {
  const unique = [...new Set(zones.map((zone) => zone?.trim()).filter((zone): zone is string => !!zone))];
  if (unique.length === 0) return "Corrections";
  if (unique.length <= 3) return `Corrections ${unique.join(", ")}`;
  const rest = unique.length - 2;
  return `Corrections ${unique.slice(0, 2).join(", ")} et ${rest} autres pages`;
}

/**
 * Lots ouverts à proposer à la clôture : cochés par défaut quand toutes leurs
 * tâches seront faites après cette mise en ligne (déjà faites, ou « À valider »
 * passées en Fait).
 */
export function roundsToClose(
  rounds: { id: string; status: RoundStatus }[],
  tasks: { id: string; status: TaskStatus; roundId?: string | null }[],
  promotedIds: ReadonlySet<string>,
): { id: string; complete: boolean }[] {
  return rounds
    .filter((round) => round.status === "OPEN")
    .map((round) => {
      const own = tasks.filter((task) => task.roundId === round.id);
      const complete = own.length > 0 && own.every((task) => task.status === "DONE" || promotedIds.has(task.id));
      return { id: round.id, complete };
    });
}
