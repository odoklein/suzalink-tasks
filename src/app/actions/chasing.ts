"use server";

import type { Channel } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { buildChaseMessage, waitingStart } from "@/lib/chasing";
import { firstName } from "@/lib/contacts";
import { getCurrentUser, verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { fromParisDateTimeInput } from "@/lib/time";

/** Relance prête à envoyer pour un projet : destinataire, objet, texte et tâches concernées. */
export async function getChaseDraft(projectId: string) {
  const user = await getCurrentUser();
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      client: {
        select: {
          contactRecords: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            take: 1,
            select: { id: true, name: true, email: true },
          },
        },
      },
      tasks: {
        where: { status: "WAITING_CLIENT" },
        orderBy: [{ waitingSince: "asc" }, { statusChangedAt: "asc" }],
        select: { id: true, title: true, zone: true, waitingFor: true, waitingSince: true, statusChangedAt: true },
      },
    },
  });
  if (!project) return { error: "Projet introuvable." };
  if (project.tasks.length === 0) return { error: "Rien n’attend le client sur ce projet." };

  const contact = project.client?.contactRecords[0] ?? null;
  const { subject, body } = buildChaseMessage({
    contactFirstName: firstName(contact?.name),
    projectName: project.name,
    senderFirstName: firstName(user.name),
    items: project.tasks.map((task) => ({
      title: task.title,
      zone: task.zone,
      waitingFor: task.waitingFor,
      since: waitingStart(task),
    })),
  });

  return {
    ok: true as const,
    subject,
    body,
    to: contact,
    taskIds: project.tasks.map((task) => task.id),
  };
}

/**
 * Enregistre une relance envoyée (copiée ou ouverte dans la messagerie) :
 * ClientMessage(FOLLOW_UP), date de relance sur le projet et ses tâches, ligne
 * d'activité, le tout dans une transaction.
 */
export async function logFollowUp(
  projectId: string,
  input: { body: string; toId?: string | null; taskIds: string[]; via?: Channel },
) {
  const { userId } = await verifySession();
  const body = input.body.trim().slice(0, 10_000);
  if (!body) return { error: "Le message est vide." };
  const via: Channel = input.via === "WEB" ? "WEB" : "EMAIL";
  const now = new Date();

  await db.$transaction(async (tx) => {
    const tasks = await tx.task.findMany({
      where: { id: { in: input.taskIds }, projectId, status: "WAITING_CLIENT" },
      select: { id: true, waitingSince: true, statusChangedAt: true },
    });
    const since = tasks.length ? new Date(Math.min(...tasks.map((task) => waitingStart(task).getTime()))) : null;
    const toId = input.toId
      ? ((await tx.contact.findUnique({ where: { id: input.toId }, select: { id: true } }))?.id ?? null)
      : null;

    const message = await tx.clientMessage.create({
      data: {
        kind: "FOLLOW_UP",
        body,
        via,
        since,
        sentAt: now,
        projectId,
        toId,
        authorId: userId,
        tasks: { connect: tasks.map((task) => ({ id: task.id })) },
      },
      select: { id: true },
    });
    await tx.project.update({ where: { id: projectId }, data: { lastChasedAt: now } });
    await tx.task.updateMany({ where: { id: { in: tasks.map((task) => task.id) } }, data: { lastChasedAt: now } });
    await logActivity(tx, {
      projectId,
      actorId: userId,
      event: { type: "CLIENT_MESSAGE", kind: "FOLLOW_UP", count: tasks.length, messageId: message.id },
    });
  });

  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** « On attend : visuels HD · relancer le lun. » sur une tâche chez le client. */
export async function setWaitingDetails(taskId: string, input: { waitingFor?: string | null; followUpAt?: string | null }) {
  await verifySession();
  const followUpAt = input.followUpAt ? fromParisDateTimeInput(`${input.followUpAt}T09:00`) : null;
  if (followUpAt && Number.isNaN(followUpAt.getTime())) return { error: "Date de relance invalide." };
  await db.task.update({
    where: { id: taskId },
    data: {
      ...(input.waitingFor !== undefined ? { waitingFor: input.waitingFor?.trim().slice(0, 200) || null } : {}),
      ...(input.followUpAt !== undefined ? { followUpAt } : {}),
    },
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
