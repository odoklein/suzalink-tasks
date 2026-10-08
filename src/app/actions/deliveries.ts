"use server";

import { revalidatePath } from "next/cache";

import { safe } from "@/lib/action";
import { logActivities, logActivity } from "@/lib/activity";
import { firstName } from "@/lib/contacts";
import { getCurrentUser, verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { buildRecapText, defaultRecapSince, type RecapFacts } from "@/lib/recap";
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
  return safe(async () => {
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
  });
}

/** Modifie une mise en ligne : texte, date, lien et tâches livrées. */
export async function updateDelivery(deliveryId: string, input: DeliveryInput) {
  return safe(async () => {
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
  });
}

/** Suppression annulable : la mise en ligne disparaît des listes, « Annuler » la restaure. */
export async function deleteDelivery(deliveryId: string) {
  return safe(async () => {
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
  });
}

export async function restoreDelivery(deliveryId: string) {
  return safe(async () => {
    await verifySession();
    await db.delivery.update({ where: { id: deliveryId }, data: { deletedAt: null } });
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

/**
 * Faits du récap client (P4-08) : le texte est construit côté navigateur
 * (src/lib/recap.ts) pour que les options le régénèrent instantanément.
 */
export async function getRecapFacts(projectId: string) {
  return safe(async () => {
    const user = await getCurrentUser();
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        key: true,
        siteUrl: true,
        client: {
          select: {
            kind: true,
            contactRecords: {
              orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
              take: 1,
              select: { id: true, name: true, email: true },
            },
          },
        },
        tasks: {
          orderBy: [{ zone: "asc" }, { number: "asc" }],
          select: {
            number: true,
            title: true,
            zone: true,
            status: true,
            billable: true,
            completedAt: true,
            waitingSince: true,
            statusChangedAt: true,
          },
        },
        deliveries: { where: { deletedAt: null }, orderBy: { deployedAt: "desc" }, take: 2, select: { deployedAt: true } },
        clientMessages: { where: { kind: "RECAP" }, orderBy: { sentAt: "desc" }, take: 1, select: { sentAt: true } },
      },
    });
    if (!project) return { error: "Projet introuvable." };
    const contact = project.client?.contactRecords[0] ?? null;

    const facts: RecapFacts = {
      projectName: project.name,
      siteUrl: project.siteUrl,
      clientKind: project.client?.kind ?? null,
      contactFirstName: firstName(contact?.name) || null,
      senderFirstName: firstName(user.name),
      lastDeliveryAt: project.deliveries[0]?.deployedAt ?? null,
      tasks: project.tasks.map((task) => ({
        ref: `${project.key}-${task.number}`,
        title: task.title,
        zone: task.zone,
        status: task.status,
        billable: task.billable,
        completedAt: task.completedAt,
        waitingSince: task.status === "WAITING_CLIENT" ? (task.waitingSince ?? task.statusChangedAt) : null,
      })),
    };
    const since = defaultRecapSince(
      project.clientMessages[0]?.sentAt ?? null,
      project.deliveries.map((delivery) => delivery.deployedAt),
    );
    return { ok: true as const, facts, defaultSince: since, to: contact };
  });
}

/** Enregistre un récap envoyé (copié ou ouvert dans la messagerie) : ClientMessage(RECAP) + historique. */
export async function logRecapSent(
  projectId: string,
  input: { body: string; since?: string | null; toId?: string | null; via?: "EMAIL" | "WEB" },
) {
  return safe(async () => {
    const { userId } = await verifySession();
    const body = input.body.trim().slice(0, 20_000);
    if (!body) return { error: "Le récap est vide." };
    const since = input.since ? new Date(input.since) : null;
    await db.$transaction(async (tx) => {
      const toId = input.toId
        ? ((await tx.contact.findUnique({ where: { id: input.toId }, select: { id: true } }))?.id ?? null)
        : null;
      const message = await tx.clientMessage.create({
        data: {
          kind: "RECAP",
          body,
          via: input.via === "WEB" ? "WEB" : "EMAIL",
          since: since && !Number.isNaN(since.getTime()) ? since : null,
          projectId,
          toId,
          authorId: userId,
        },
        select: { id: true },
      });
      await logActivity(tx, {
        projectId,
        actorId: userId,
        event: { type: "CLIENT_MESSAGE", kind: "RECAP", messageId: message.id },
      });
    });
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

/** Compatibilité : récap client calculé à la volée. */
export async function buildRecap(projectId: string, sinceIso?: string) {
  return safe(async () => {
    const factsResult = await getRecapFacts(projectId);
    if ("error" in factsResult || !factsResult.ok) return factsResult;
    const since = sinceIso
      ? /^\d{4}-\d{2}-\d{2}$/.test(sinceIso)
        ? fromParisDateTimeInput(`${sinceIso}T00:00`)
        : new Date(sinceIso)
      : (factsResult.defaultSince ?? null);
    const result = buildRecapText(factsResult.facts, {
      since,
      whiteLabel: false,
      includeBillable: true,
      includeWaiting: true,
    });
    return {
      ok: true as const,
      text: result.text,
      counts: {
        done: result.counts.done,
        waiting: result.counts.waiting,
        remaining: result.counts.remaining,
      },
    };
  });
}
