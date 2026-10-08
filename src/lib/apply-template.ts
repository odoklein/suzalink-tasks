import "server-only";

import type { Prisma } from "@prisma/client";

import { planFromTemplate } from "@/lib/templates";
import { ensureZones } from "@/lib/zones";

/**
 * Applique un modèle à un projet tout juste créé (même transaction) : pages,
 * jalons et tâches de départ avec échéances relatives au démarrage.
 * Renvoie le nombre de tâches créées (0 si le modèle n'existe pas).
 */
export async function applyTemplate(
  tx: Prisma.TransactionClient,
  input: { projectId: string; templateId: string; start: Date; creatorId: string },
): Promise<{ name: string; count: number } | null> {
  const template = await tx.projectTemplate.findUnique({
    where: { id: input.templateId },
    include: { tasks: { orderBy: { position: "asc" } } },
  });
  if (!template) return null;

  const plan = planFromTemplate(template, input.start);
  const zoneIds = await ensureZones(tx, input.projectId, plan.zones);
  if (plan.milestones.length) {
    await tx.milestone.createMany({
      data: plan.milestones.map((milestone) => ({ ...milestone, projectId: input.projectId })),
    });
  }
  const milestones = await tx.milestone.findMany({ where: { projectId: input.projectId }, select: { id: true, name: true } });
  const milestoneIds = new Map(milestones.map((milestone) => [milestone.name, milestone.id]));

  if (plan.tasks.length) {
    await tx.task.createMany({
      data: plan.tasks.map((task, index) => ({
        projectId: input.projectId,
        number: index + 1,
        title: task.title,
        zone: task.zone,
        zoneId: task.zone ? (zoneIds.get(task.zone) ?? null) : null,
        milestoneId: task.milestone ? (milestoneIds.get(task.milestone) ?? null) : null,
        dueDate: task.dueDate,
        position: task.position,
        creatorId: input.creatorId,
      })),
    });
    await tx.project.update({ where: { id: input.projectId }, data: { taskCounter: plan.tasks.length } });
  }
  // Le type du modèle s'applique si aucun type n'a été choisi.
  await tx.project.updateMany({ where: { id: input.projectId, type: "OTHER" }, data: { type: template.type } });
  return { name: template.name, count: plan.tasks.length };
}
