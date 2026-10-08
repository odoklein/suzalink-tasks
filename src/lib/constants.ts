import type { Priority, ProjectStatus, TaskStatus } from "@prisma/client";

import { PROJECT_PALETTE } from "@/lib/color";

export const TASK_STATUSES: {
  value: TaskStatus;
  label: string;
  short: string;
  tone: string;
  /** Variante lisible comme texte (contraste AA) du ton solide. */
  text: string;
}[] = [
  { value: "TODO", label: "À faire", short: "À faire", tone: "var(--todo)", text: "var(--todo-text)" },
  { value: "IN_PROGRESS", label: "En cours", short: "En cours", tone: "var(--progress)", text: "var(--progress-text)" },
  { value: "WAITING_CLIENT", label: "En attente client", short: "Attente client", tone: "var(--waiting)", text: "var(--waiting-text)" },
  { value: "REVIEW", label: "À valider", short: "À valider", tone: "var(--review)", text: "var(--review-text)" },
  { value: "DONE", label: "Fait", short: "Fait", tone: "var(--done)", text: "var(--done-text)" },
];

export const STATUS_BY_VALUE = Object.fromEntries(
  TASK_STATUSES.map((status) => [status.value, status]),
) as Record<TaskStatus, (typeof TASK_STATUSES)[number]>;

export const PRIORITIES: { value: Priority; label: string; rank: number }[] = [
  { value: "URGENT", label: "Urgente", rank: 4 },
  { value: "HIGH", label: "Haute", rank: 3 },
  { value: "MEDIUM", label: "Moyenne", rank: 2 },
  { value: "LOW", label: "Basse", rank: 1 },
  { value: "NONE", label: "Aucune", rank: 0 },
];

export const PRIORITY_BY_VALUE = Object.fromEntries(
  PRIORITIES.map((priority) => [priority.value, priority]),
) as Record<Priority, (typeof PRIORITIES)[number]>;

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; tone: string; text: string }[] = [
  { value: "ACTIVE", label: "En cours", tone: "var(--progress)", text: "var(--progress-text)" },
  { value: "WAITING_CLIENT", label: "En attente client", tone: "var(--waiting)", text: "var(--waiting-text)" },
  { value: "PAUSED", label: "En pause", tone: "var(--todo)", text: "var(--todo-text)" },
  { value: "DONE", label: "Livré", tone: "var(--done)", text: "var(--done-text)" },
];

export const PROJECT_STATUS_BY_VALUE = Object.fromEntries(
  PROJECT_STATUSES.map((status) => [status.value, status]),
) as Record<ProjectStatus, (typeof PROJECT_STATUSES)[number]>;

/** Couleurs proposées pour les projets (variante claire ; la sombre vient de PROJECT_PALETTE). */
export const PROJECT_COLORS: string[] = PROJECT_PALETTE.map((entry) => entry.light);
