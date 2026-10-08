"use server";

import type { ProjectType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { parseTemplateTasks, PROJECT_TYPES } from "@/lib/templates";

/** Modèles de projet, pour « Nouveau projet ». */
export async function listTemplates() {
  await verifySession();
  return db.projectTemplate.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true, _count: { select: { tasks: true } } },
  });
}

export type TemplateInput = {
  name: string;
  type: ProjectType;
  milestones: string;
  zones: string;
  tasks: string;
};

const lines = (text: string) =>
  [...new Set(text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))].slice(0, 100);

/** Crée (id null) ou remplace un modèle ; ses tâches sont réécrites à partir du texte. */
export async function saveTemplate(id: string | null, input: TemplateInput) {
  await verifySession();
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "Donnez un nom au modèle." };
  const type = PROJECT_TYPES.some((t) => t.value === input.type) ? input.type : "OTHER";
  const tasks = parseTemplateTasks(input.tasks).slice(0, 200);
  const data = { name, type, milestones: lines(input.milestones), zones: lines(input.zones) };

  try {
    await db.$transaction(async (tx) => {
      const template = id
        ? await tx.projectTemplate.update({ where: { id }, data, select: { id: true } })
        : await tx.projectTemplate.create({ data, select: { id: true } });
      await tx.templateTask.deleteMany({ where: { templateId: template.id } });
      if (tasks.length) {
        await tx.templateTask.createMany({
          data: tasks.map((task, index) => ({ ...task, templateId: template.id, position: (index + 1) * 1000 })),
        });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Un modèle porte déjà ce nom." };
    }
    throw error;
  }
  revalidatePath("/settings/templates");
  return { ok: true as const };
}

export async function deleteTemplate(id: string) {
  await verifySession();
  await db.projectTemplate.delete({ where: { id } });
  revalidatePath("/settings/templates");
  return { ok: true as const };
}
