"use server";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { revalidatePath } from "next/cache";

import { STATUS_BY_VALUE } from "@/lib/constants";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";

export async function createDelivery(
  projectId: string,
  input: { title: string; notes?: string; url?: string; deployedAt?: string },
) {
  const { userId } = await verifySession();
  const title = input.title.trim();
  if (!title) return { error: "Décrivez ce qui a été mis en ligne." };

  await db.delivery.create({
    data: {
      projectId,
      authorId: userId,
      title,
      notes: input.notes?.trim() || null,
      url: input.url?.trim() || null,
      deployedAt: input.deployedAt ? new Date(input.deployedAt) : new Date(),
    },
  });
  await db.activity.create({
    data: { projectId, actorId: userId, message: `a enregistré une mise en ligne : ${title}` },
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/**
 * Récap client prêt à envoyer : tâches faites depuis une date, regroupées par
 * page, puis ce qui attend le client et ce qui reste à faire.
 */
export async function buildRecap(projectId: string, sinceIso?: string) {
  await verifySession();
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: { orderBy: [{ zone: "asc" }, { number: "asc" }] },
      deliveries: { orderBy: { deployedAt: "desc" }, take: 1 },
    },
  });
  if (!project) return { error: "Projet introuvable." };

  const since = sinceIso ? new Date(sinceIso) : undefined;
  const done = project.tasks.filter(
    (task) => task.status === "DONE" && (!since || (task.completedAt && task.completedAt >= since)),
  );
  const waiting = project.tasks.filter((task) => task.status === "WAITING_CLIENT");
  const remaining = project.tasks.filter((task) =>
    ["TODO", "IN_PROGRESS", "REVIEW"].includes(task.status),
  );

  const byZone = (tasks: typeof done) => {
    const groups = new Map<string, typeof done>();
    for (const task of tasks) {
      const zone = task.zone || "Général";
      groups.set(zone, [...(groups.get(zone) ?? []), task]);
    }
    return [...groups.entries()]
      .map(([zone, items]) => `${zone}\n${items.map((t) => `  - ${t.title}`).join("\n")}`)
      .join("\n\n");
  };

  const lastDelivery = project.deliveries[0];
  const lines = [
    `Bonjour,`,
    ``,
    lastDelivery
      ? `Voici le point sur ${project.name}. Dernière mise en ligne le ${format(lastDelivery.deployedAt, "d MMMM 'à' HH'h'mm", { locale: fr })}${project.siteUrl ? ` : ${project.siteUrl}` : ""}.`
      : `Voici le point sur ${project.name}.`,
    `Pensez à faire un rafraîchissement forcé (Ctrl+F5) pour voir la dernière version.`,
  ];
  if (done.length) lines.push(``, `CE QUI EST FAIT`, ``, byZone(done));
  if (waiting.length) lines.push(``, `EN ATTENTE DE VOTRE CÔTÉ`, ``, byZone(waiting));
  if (remaining.length) {
    lines.push(
      ``,
      `EN COURS CHEZ NOUS`,
      ``,
      remaining.map((t) => `  - ${t.title} (${STATUS_BY_VALUE[t.status].label.toLowerCase()})`).join("\n"),
    );
  }
  lines.push(``, `Belle journée,`);

  return {
    ok: true as const,
    text: lines.join("\n"),
    counts: { done: done.length, waiting: waiting.length, remaining: remaining.length },
  };
}
