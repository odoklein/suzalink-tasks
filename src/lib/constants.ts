import type { Priority, ProjectStatus, TaskStatus } from "@prisma/client";

export const TASK_STATUSES: {
  value: TaskStatus;
  label: string;
  short: string;
  tone: string;
  /** Infobulle qui précise le sens du statut. */
  hint?: string;
}[] = [
  { value: "TODO", label: "À faire", short: "À faire", tone: "var(--st-todo)" },
  { value: "IN_PROGRESS", label: "En cours", short: "En cours", tone: "var(--st-progress)" },
  { value: "WAITING_CLIENT", label: "En attente client", short: "Chez le client", tone: "var(--st-waiting)" },
  {
    value: "REVIEW",
    label: "À valider",
    short: "À valider",
    tone: "var(--st-review)",
    hint: "Vérification interne avant d’annoncer au client",
  },
  { value: "DONE", label: "Fait", short: "Fait", tone: "var(--st-done)" },
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

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; tone: string }[] = [
  { value: "ACTIVE", label: "En cours", tone: "var(--st-progress)" },
  { value: "WAITING_CLIENT", label: "En attente client", tone: "var(--st-waiting)" },
  { value: "PAUSED", label: "En pause", tone: "var(--st-todo)" },
  { value: "DONE", label: "Livré", tone: "var(--st-done)" },
];

export const PROJECT_STATUS_BY_VALUE = Object.fromEntries(
  PROJECT_STATUSES.map((status) => [status.value, status]),
) as Record<ProjectStatus, (typeof PROJECT_STATUSES)[number]>;

/** Couleurs proposées pour les projets. */
export const PROJECT_COLORS = [
  "#E5533D",
  "#E8913A",
  "#C9A227",
  "#2E9E6B",
  "#1F8A9E",
  "#3B6CF6",
  "#6A5AE0",
  "#B04FA8",
  "#55606E",
];
