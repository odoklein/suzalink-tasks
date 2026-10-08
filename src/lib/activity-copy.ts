import type { ActivityType, Priority, ProjectStatus, TaskStatus } from "@prisma/client";

import { PRIORITY_BY_VALUE, PROJECT_STATUS_BY_VALUE, STATUS_BY_VALUE } from "@/lib/constants";
import { plural } from "@/lib/plural";
import { formatParis } from "@/lib/time";

/**
 * Journal d'activité : un seul endroit pour le texte français (P4-01).
 *
 * Chaque événement est un objet typé ; `describeActivity` en tire le message
 * affiché (stocké dans `Activity.message`, donc les anciens écrans continuent
 * de fonctionner) et les champs structurés (`fromStatus`, `toStatus`, `data`).
 * Module pur (sans accès base) : testable tel quel.
 */

/** Espace fine insécable : se place avant « : », « ; », « ! », « ? ». */
const NNBSP = " ";
const colon = `${NNBSP}:`;

export type Person = { id: string; name: string };

export type ActivityEvent =
  | { type: "NOTE"; message: string }
  | { type: "TASK_CREATED"; ref: string; title: string }
  | { type: "STATUS_CHANGED"; ref: string; from: TaskStatus; to: TaskStatus }
  | { type: "ASSIGNED"; ref: string; from: Person | null; to: Person | null }
  | { type: "BILLABLE_CHANGED"; ref: string; from: boolean; to: boolean }
  | { type: "DUE_CHANGED"; ref: string; from: Date | null; to: Date | null }
  | { type: "PRIORITY_CHANGED"; ref: string; from: Priority; to: Priority }
  | { type: "TITLE_CHANGED"; ref: string; from: string; to: string }
  | { type: "COMMENTED"; ref: string }
  | { type: "TASK_DELETED"; ref: string; title: string }
  | { type: "TASK_RESTORED"; ref: string }
  | { type: "IMPORTED"; created: number; updated?: number; source?: string }
  | { type: "DELIVERED"; title: string }
  | { type: "CLIENT_MESSAGE"; kind: "RECAP" | "FOLLOW_UP" | "QUOTE"; count?: number }
  | {
      type: "PROJECT_UPDATED";
      change: "created" | "status" | "note";
      from?: ProjectStatus;
      to?: ProjectStatus;
    };

export type DescribedActivity = {
  type: ActivityType;
  message: string;
  fromStatus?: TaskStatus;
  toStatus?: TaskStatus;
  data?: Record<string, unknown>;
};

const quote = (text: string) => `«${NNBSP}${text}${NNBSP}»`;
const day = (date: Date) => formatParis(date, "d MMM yyyy");

const CLIENT_MESSAGE_COPY = {
  RECAP: "a envoyé un récap au client",
  FOLLOW_UP: "a relancé le client",
  QUOTE: "a envoyé un devis au client",
} as const;

export function describeActivity(event: ActivityEvent): DescribedActivity {
  switch (event.type) {
    case "NOTE":
      return { type: "NOTE", message: event.message };

    case "TASK_CREATED":
      return {
        type: "TASK_CREATED",
        message: `a créé ${event.ref} ${quote(event.title)}`,
        data: { ref: event.ref, title: event.title },
      };

    case "STATUS_CHANGED":
      return {
        type: "STATUS_CHANGED",
        message: `a passé ${event.ref} de ${quote(STATUS_BY_VALUE[event.from].label)} à ${quote(STATUS_BY_VALUE[event.to].label)}`,
        fromStatus: event.from,
        toStatus: event.to,
        data: { ref: event.ref },
      };

    case "ASSIGNED": {
      const { from, to, ref } = event;
      const message = !to
        ? `a retiré l’attribution de ${ref}${from ? ` (avant${colon} ${from.name})` : ""}`
        : from
          ? `a réattribué ${ref} à ${to.name} (avant${colon} ${from.name})`
          : `a attribué ${ref} à ${to.name}`;
      return { type: "ASSIGNED", message, data: { ref, from, to } };
    }

    case "BILLABLE_CHANGED":
      return {
        type: "BILLABLE_CHANGED",
        message: event.to
          ? `a marqué ${event.ref} hors périmètre (€)`
          : `a retiré ${event.ref} du hors périmètre (€)`,
        data: { ref: event.ref, from: event.from, to: event.to },
      };

    case "DUE_CHANGED": {
      const { from, to, ref } = event;
      const message = !to
        ? `a retiré l’échéance de ${ref}${from ? ` (avant${colon} ${day(from)})` : ""}`
        : from
          ? `a décalé l’échéance de ${ref} du ${day(from)} au ${day(to)}`
          : `a fixé l’échéance de ${ref} au ${day(to)}`;
      return {
        type: "DUE_CHANGED",
        message,
        data: { ref, from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
      };
    }

    case "PRIORITY_CHANGED":
      return {
        type: "PRIORITY_CHANGED",
        message: `a changé la priorité de ${event.ref}${colon} ${PRIORITY_BY_VALUE[event.from].label.toLowerCase()} → ${PRIORITY_BY_VALUE[event.to].label.toLowerCase()}`,
        data: { ref: event.ref, from: event.from, to: event.to },
      };

    case "TITLE_CHANGED":
      return {
        type: "TITLE_CHANGED",
        message: `a renommé ${event.ref}${colon} ${quote(event.from)} → ${quote(event.to)}`,
        data: { ref: event.ref, from: event.from, to: event.to },
      };

    case "COMMENTED":
      return { type: "COMMENTED", message: `a commenté ${event.ref}`, data: { ref: event.ref } };

    case "TASK_DELETED":
      return {
        type: "TASK_DELETED",
        message: `a supprimé ${event.ref} ${quote(event.title)}`,
        data: { ref: event.ref, title: event.title },
      };

    case "TASK_RESTORED":
      return { type: "TASK_RESTORED", message: `a restauré ${event.ref}`, data: { ref: event.ref } };

    case "IMPORTED": {
      const parts = [`a importé ${plural(event.created, "retour")}`];
      if (event.updated) parts.push(`mis à jour ${plural(event.updated, "tâche existante", "tâches existantes")}`);
      const source = event.source ? ` (${event.source})` : "";
      return {
        type: "IMPORTED",
        message: `${parts.join(", ")}${source}`,
        data: { created: event.created, updated: event.updated ?? 0, source: event.source ?? null },
      };
    }

    case "DELIVERED":
      return {
        type: "DELIVERED",
        message: `a enregistré une mise en ligne${colon} ${event.title}`,
        data: { title: event.title },
      };

    case "CLIENT_MESSAGE":
      return {
        type: "CLIENT_MESSAGE",
        message: CLIENT_MESSAGE_COPY[event.kind],
        data: { kind: event.kind, count: event.count ?? null },
      };

    case "PROJECT_UPDATED": {
      if (event.change === "created") return { type: "PROJECT_UPDATED", message: "a créé le projet", data: { change: "created" } };
      if (event.change === "note") return { type: "PROJECT_UPDATED", message: "a mis à jour le point d’étape", data: { change: "note" } };
      const from = event.from ? PROJECT_STATUS_BY_VALUE[event.from].label : null;
      const to = event.to ? PROJECT_STATUS_BY_VALUE[event.to].label : null;
      return {
        type: "PROJECT_UPDATED",
        message:
          from && to
            ? `a passé le projet de ${quote(from)} à ${quote(to)}`
            : "a changé le statut du projet",
        data: { change: "status", from: event.from ?? null, to: event.to ?? null },
      };
    }
  }
}
