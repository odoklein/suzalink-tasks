"use server";

import type { ExtraStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { logActivity } from "@/lib/activity";
import { firstName } from "@/lib/contacts";
import { getCurrentUser, verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { buildQuoteMessage, canTransition, EXTRA_STATUS_LABELS } from "@/lib/extras";

function refresh() {
  revalidatePath("/", "layout");
}

/** Regroupe des tâches hors périmètre (sans avenant) dans un nouvel avenant, numéroté dans le projet. */
export async function createExtra(projectId: string, input: { title: string; taskIds: string[] }) {
  const { userId } = await verifySession();
  const title = input.title.trim().slice(0, 200);
  if (!title) return { error: "Donnez un intitulé à l’avenant." };

  const number = await db.$transaction(async (tx) => {
    const tasks = await tx.task.findMany({
      where: { projectId, id: { in: input.taskIds }, billable: true, extraId: null },
      select: { id: true, estimatedAmountCents: true },
    });
    const priced = tasks.filter((task) => task.estimatedAmountCents !== null);
    const last = await tx.extra.findFirst({ where: { projectId }, orderBy: { number: "desc" }, select: { number: true } });
    const extra = await tx.extra.create({
      data: {
        projectId,
        number: (last?.number ?? 0) + 1,
        title,
        amountCents: priced.length ? priced.reduce((sum, task) => sum + (task.estimatedAmountCents ?? 0), 0) : null,
        tasks: { connect: tasks.map((task) => ({ id: task.id })) },
      },
      select: { number: true },
    });
    await logActivity(tx, {
      projectId,
      actorId: userId,
      event: { type: "NOTE", message: `a créé l’avenant AV-${extra.number} « ${title} »` },
    });
    return extra.number;
  });
  refresh();
  return { ok: true as const, number };
}

export async function updateExtra(extraId: string, input: { title?: string; amountCents?: number | null }) {
  await verifySession();
  const title = input.title?.trim().slice(0, 200);
  if (input.title !== undefined && !title) return { error: "Donnez un intitulé à l’avenant." };
  if (input.amountCents !== undefined && input.amountCents !== null && (input.amountCents < 0 || !Number.isInteger(input.amountCents))) {
    return { error: "Montant invalide." };
  }
  await db.extra.update({
    where: { id: extraId },
    data: { ...(title ? { title } : {}), ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}) },
  });
  refresh();
  return { ok: true as const };
}

/** Fait avancer un avenant : accepté (par qui), refusé, facturé (référence externe), payé. */
export async function setExtraStatus(
  extraId: string,
  to: ExtraStatus,
  details: { approvedBy?: string; invoiceRef?: string } = {},
) {
  const { userId } = await verifySession();
  const extra = await db.extra.findUnique({ where: { id: extraId }, select: { status: true, projectId: true, number: true } });
  if (!extra) return { error: "Avenant introuvable." };
  if (!canTransition(extra.status, to)) return { error: "Ce changement d’état n’est pas possible." };
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.extra.update({
      where: { id: extraId },
      data: {
        status: to,
        ...(to === "APPROVED" ? { approvedAt: now, approvedBy: details.approvedBy?.trim().slice(0, 120) || null } : {}),
        ...(to === "INVOICED" ? { invoicedAt: now, invoiceRef: details.invoiceRef?.trim().slice(0, 80) || null } : {}),
        ...(to === "PAID" ? { paidAt: now } : {}),
        ...(to === "DRAFT" ? { quotedAt: null, approvedAt: null, approvedBy: null } : {}),
      },
    });
    await logActivity(tx, {
      projectId: extra.projectId,
      actorId: userId,
      event: { type: "NOTE", message: `a passé l’avenant AV-${extra.number} en « ${EXTRA_STATUS_LABELS[to]} »` },
    });
  });
  refresh();
  return { ok: true as const };
}

/** Devis prêt à envoyer pour un avenant. */
export async function getQuoteDraft(extraId: string) {
  const user = await getCurrentUser();
  const extra = await db.extra.findUnique({
    where: { id: extraId },
    select: {
      number: true,
      title: true,
      amountCents: true,
      project: {
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
        },
      },
      tasks: { orderBy: { number: "asc" }, select: { title: true, zone: true, estimatedAmountCents: true } },
    },
  });
  if (!extra) return { error: "Avenant introuvable." };
  const contact = extra.project.client?.contactRecords[0] ?? null;
  const message = buildQuoteMessage({
    contactFirstName: firstName(contact?.name) || null,
    projectName: extra.project.name,
    extraNumber: extra.number,
    extraTitle: extra.title,
    amountCents: extra.amountCents,
    senderFirstName: firstName(user.name),
    items: extra.tasks.map((task) => ({ title: task.title, zone: task.zone, amountCents: task.estimatedAmountCents })),
  });
  return { ok: true as const, ...message, to: contact };
}

/** Le devis a été envoyé : ClientMessage(QUOTE), avenant « Devis envoyé », historique. */
export async function logQuoteSent(extraId: string, input: { body: string; toId?: string | null; via?: "EMAIL" | "WEB" }) {
  const { userId } = await verifySession();
  const body = input.body.trim().slice(0, 20_000);
  if (!body) return { error: "Le devis est vide." };
  const extra = await db.extra.findUnique({ where: { id: extraId }, select: { status: true, projectId: true } });
  if (!extra) return { error: "Avenant introuvable." };
  if (extra.status !== "DRAFT" && extra.status !== "QUOTED") return { error: "Cet avenant a déjà une réponse du client." };

  await db.$transaction(async (tx) => {
    const toId = input.toId
      ? ((await tx.contact.findUnique({ where: { id: input.toId }, select: { id: true } }))?.id ?? null)
      : null;
    const message = await tx.clientMessage.create({
      data: { kind: "QUOTE", body, via: input.via === "WEB" ? "WEB" : "EMAIL", projectId: extra.projectId, toId, authorId: userId },
      select: { id: true },
    });
    await tx.extra.update({ where: { id: extraId }, data: { status: "QUOTED", quotedAt: new Date() } });
    await logActivity(tx, {
      projectId: extra.projectId,
      actorId: userId,
      event: { type: "CLIENT_MESSAGE", kind: "QUOTE", messageId: message.id },
    });
  });
  refresh();
  return { ok: true as const };
}
