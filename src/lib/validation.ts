import { z } from "zod";

/**
 * Schémas d'entrée partagés par les Server Actions, l'API REST et le serveur
 * MCP. Pas de `server-only` : ils peuvent aussi servir côté client.
 */

export const TASK_STATUS_VALUES = ["TODO", "IN_PROGRESS", "WAITING_CLIENT", "REVIEW", "DONE"] as const;
export const PRIORITY_VALUES = ["NONE", "LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const PROJECT_STATUS_VALUES = ["ACTIVE", "WAITING_CLIENT", "PAUSED", "DONE"] as const;

export const idSchema = z.string().trim().min(1, "Identifiant manquant.").max(64);
export const taskStatusSchema = z.enum(TASK_STATUS_VALUES, { error: "Statut inconnu." });
export const prioritySchema = z.enum(PRIORITY_VALUES, { error: "Priorité inconnue." });
export const projectStatusSchema = z.enum(PROJECT_STATUS_VALUES, { error: "Statut de projet inconnu." });

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `${max} caractères maximum.`)
    .nullish()
    .transform((value) => (value == null ? value : value.trim() || null));

/** Date ISO (`yyyy-MM-dd` ou date-heure complète), ou null pour effacer. */
export const isoDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Date invalide.");

export const titleSchema = z.string().trim().min(1, "Donnez un titre à la tâche.").max(500, "Titre trop long.");

export const newTaskSchema = z.object({
  projectId: idSchema,
  title: titleSchema,
  description: optionalText(20000),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.optional(),
  zone: optionalText(120),
  source: optionalText(200),
  billable: z.boolean().optional(),
  assigneeId: idSchema.nullish(),
  dueDate: z.date().nullish(),
});
export type NewTaskInput = z.input<typeof newTaskSchema>;

export const taskPatchSchema = z
  .object({
    title: z.string().trim().min(1, "Le titre ne peut pas être vide.").max(500, "Titre trop long."),
    description: optionalText(20000),
    status: taskStatusSchema,
    priority: prioritySchema,
    zone: optionalText(120),
    source: optionalText(200),
    billable: z.boolean(),
    assigneeId: z.string().max(64).nullable().transform((value) => value || null),
    dueDate: isoDateSchema.nullable(),
  })
  .partial();
export type TaskPatchInput = z.input<typeof taskPatchSchema>;

export const moveTaskSchema = z.object({
  taskId: idSchema,
  status: taskStatusSchema,
  position: z.number().finite("Position invalide."),
});

export const commentSchema = z.object({
  taskId: idSchema,
  body: z.string().trim().min(1, "Le commentaire est vide.").max(10000, "Commentaire trop long."),
});

export const deliverySchema = z.object({
  title: z.string().trim().min(1, "Décrivez ce qui a été mis en ligne.").max(300),
  notes: optionalText(5000),
  url: optionalText(2000),
  deployedAt: isoDateSchema.optional().or(z.literal("")),
});

export const projectNoteSchema = z.object({
  projectId: idSchema,
  note: z.string().transform((value) => value.trim().slice(0, 600)),
});

export const newProjectSchema = z.object({
  name: z.string().trim().min(1, "Donnez un nom au projet.").max(120),
  key: z
    .string()
    .trim()
    .max(6)
    .transform((value) => value.toUpperCase())
    .optional(),
  clientId: z.string().max(64).nullish(),
  newClient: z
    .object({ name: z.string().trim().min(1).max(120), kind: z.enum(["AGENCY", "DIRECT"]) })
    .nullish(),
  color: z.string().max(16).nullish(),
  endClient: optionalText(200),
  siteUrl: optionalText(2000),
  description: optionalText(5000),
  dueDate: z.date().nullish(),
});
export type NewProjectInput = z.input<typeof newProjectSchema>;
