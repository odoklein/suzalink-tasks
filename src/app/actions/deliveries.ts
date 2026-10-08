"use server";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { revalidatePath } from "next/cache";

import { logActivities, logActivity } from "@/lib/activity";
import { STATUS_BY_VALUE } from "@/lib/constants";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { fromParisDateTimeInput } from "@/lib/time";

export type DeliveryInput = {
  title: string;
  notes?: string;
  url?: string;
  /** Valeur d'un `<input type="datetime-local">`, saisie à l'heure de Paris. */
  deployedAt?: string;
  /** Tâches livrées par cette mise en ligne. */
  taskIds?: string[];
  /** Tâches « À valider » à passer en Fait. */
  promoteIds?: string[];
  /** Lots de retours ouverts à clôturer avec cette mise en ligne. */
  closeRoundIds?: string[];
};

function readInput(input: DeliveryInput) {
  const title = input.title.trim().slice(0, 300);
  if (!title) return { error: "Décrivez ce qui a été mis en ligne." } as const;
  const url = input.url?.trim() || null;
  if (url && !/^https?:\/\/\S+$/i.test(url)) return { error: "Le lien doit commencer par http:// ou https://." } as const;
  // Le navigateur envoie l'heure murale de Paris sans fuseau : on la convertit ici (serveur en UTC).
  const deployedAt = input.deployedAt ? fromParisDateTimeInput(input.deployedAt) : new Date();
  if (Number.isNaN(deployedAt.getTime())) return { error: "Date de mise en ligne invalide." } as const;
  return { data: { title, notes: input.notes?.trim().slice(0, 5000) || null, url, deployedAt } } as const;
}

/**
 * Enregistre une mise en ligne avec son contenu, en une transaction : tâches
 * livrées, « À valider » passées en Fait, lots de retours clôturés, historique.
 */
export async function createDelivery(projectId: string, input: DeliveryInput) {
  const { userId } = await verifySession();
  const parsed = readInput(input);
  if ("error" in parsed) return parsed;
  const now = new Date();

  const deliveryId = await db.$transaction(async (tx) => {
    const delivery = await tx.delivery.create({
      data: { projectId, authorId: userId, ...parsed.data },
      select: { id: true },
    });
    const included = await tx.task.findMany({
      where: { projectId, id: { in: [...(input.taskIds ?? []), ...(input.promoteIds ?? [])] } },
      select: { id: true, number: true, status: true, completedAt: true, project: { select: { key: true } } },
    });
    if (included.length) {
      await tx.deliveryTask.createMany({
        data: included.map((task) => ({ deliveryId: delivery.id, taskId: task.id })),
        skipDuplicates: true,
      });
    }

    const promote = included.filter((task) => task.status === "REVIEW" && input.promoteIds?.includes(task.id));
    if (promote.length) {
      const top = await tx.task.findFirst({
        where: { projectId, status: "DONE" },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      let position = top?.position ?? 0;
      for (const task of promote) {
        position += 1000;
        await tx.task.update({
          where: { id: task.id },
          data: { status: "DONE", statusChangedAt: now, completedAt: now, position, waitingSince: null },
        });
      }
      await logActivities(
        tx,
        promote.map((task) => ({
          projectId,
          taskId: task.id,
          actorId: userId,
          event: { type: "STATUS_CHANGED" as const, ref: `${task.project.key}-${task.number}`, from: task.status, to: "DONE" as const },
        })),
      );
    }

    if (input.closeRoundIds?.length) {
      await tx.feedbackRound.updateMany({
        where: { id: { in: input.closeRoundIds }, projectId, status: "OPEN" },
        data: { status: "DELIVERED", closedById: delivery.id },
      });
    }

    await logActivity(tx, { projectId, actorId: userId, event: { type: "DELIVERED", title: parsed.data.title } });
    return delivery.id;
  });
  revalidatePath("/", "layout");
  return { ok: true as const, id: deliveryId };
}

/** Modifie une mise en ligne : texte, date, lien et tâches livrées. */
export async function updateDelivery(deliveryId: string, input: DeliveryInput) {
  await verifySession();
  const parsed = readInput(input);
  if ("error" in parsed) return parsed;
  const current = await db.delivery.findUnique({ where: { id: deliveryId }, select: { projectId: true } });
  if (!current) return { error: "Mise en ligne introuvable." };

  await db.$transaction(async (tx) => {
    await tx.delivery.update({ where: { id: deliveryId }, data: parsed.data });
    if (input.taskIds) {
      const valid = await tx.task.findMany({
        where: { projectId: current.projectId, id: { in: input.taskIds } },
        select: { id: true },
      });
      await tx.deliveryTask.deleteMany({ where: { deliveryId } });
      if (valid.length) {
        await tx.deliveryTask.createMany({ data: valid.map((task) => ({ deliveryId, taskId: task.id })) });
      }
    }
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Suppression annulable : la mise en ligne disparaît des listes, « Annuler » la restaure. */
export async function deleteDelivery(deliveryId: string) {
  const { userId } = await verifySession();
  const delivery = await db.delivery.update({
    where: { id: deliveryId },
    data: { deletedAt: new Date() },
    select: { projectId: true, title: true },
  });
  await logActivity(db, {
    projectId: delivery.projectId,
    actorId: userId,
    event: { type: "NOTE", message: `a supprimé la mise en ligne « ${delivery.title} »` },
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function restoreDelivery(deliveryId: string) {
  await verifySession();
  await db.delivery.update({ where: { id: deliveryId }, data: { deletedAt: null } });
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
      deliveries: { where: { deletedAt: null }, orderBy: { deployedAt: "desc" }, take: 1 },
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
