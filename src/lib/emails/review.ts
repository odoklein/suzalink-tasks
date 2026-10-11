import "server-only";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { isValidEmail } from "@/lib/contacts";
import { db } from "@/lib/db";
import { EMAIL_JOBS, queueGmailSearch } from "@/lib/emails/sync";
import { NNBSP, quote } from "@/lib/fr";
import { enqueueJob } from "@/lib/jobs/queue";
import { plural } from "@/lib/plural";
import { logActivity } from "@/lib/services/activity";
import { parseInput, parseTaskRef, ServiceError, taskRef, type Actor, type Tx } from "@/lib/services/core";
import { emitEvent } from "@/lib/services/outbox";
import { createTasksTx } from "@/lib/services/tasks";
import { formatParis, fromParisDateInput } from "@/lib/time";
import { idSchema, titleSchema } from "@/lib/validation";

/**
 * Revue des e-mails clients : actions proposées créées, rattachées ou
 * ignorées par un membre ; rattachement client / projet corrigé à la main ;
 * interlocuteurs inconnus ajoutés comme contacts.
 */

type UserActor = Actor & { userId: string };

const emailLabel = (sentAt: Date) => `E-mail du ${formatParis(sentAt, "dd/MM")}`;

async function requireEmail(tx: Tx, emailId: string) {
  const email = await tx.emailMessage.findUnique({ where: { id: emailId } });
  if (!email) throw new ServiceError("E-mail introuvable.", "NOT_FOUND");
  return email;
}

async function closeIfReviewed(tx: Tx, emailId: string) {
  const pending = await tx.emailProposal.count({ where: { emailId, status: "PENDING" } });
  await tx.emailMessage.update({ where: { id: emailId }, data: { analysis: pending === 0 ? "REVIEWED" : "READY" } });
}

/** Corrige le rattachement : un projet (son client suit), ou un client seul, ou rien. */
export async function setEmailRoute(emailId: string, route: { projectId: string | null; clientId: string | null }) {
  await db.$transaction(async (tx) => {
    const email = await requireEmail(tx, emailId);
    let clientId = route.clientId;
    if (route.projectId) {
      const project = await tx.project.findUnique({ where: { id: route.projectId }, select: { clientId: true, archived: true } });
      if (!project || project.archived) throw new ServiceError("Projet introuvable.", "NOT_FOUND");
      clientId = project.clientId ?? clientId;
    }
    if (email.roundId && email.projectId !== route.projectId) {
      throw new ServiceError("Des tâches ont déjà été créées depuis cet e-mail : le projet ne peut plus changer.", "CONFLICT");
    }
    await tx.emailMessage.update({ where: { id: emailId }, data: { projectId: route.projectId, clientId, routedBy: "manuel" } });
  });
}

const acceptSchema = z
  .array(
    z.object({
      proposalId: idSchema,
      title: titleSchema,
      assigneeId: idSchema.nullable(),
      dueDate: z.string().nullable(),
      zone: z.string().trim().max(120).nullable(),
    }),
  )
  .min(1, "Choisissez au moins une action.")
  .max(50);
export type AcceptEmailProposalInput = z.input<typeof acceptSchema>[number];

/** « Créer les tâches » : une tâche par action choisie, dans le lot de l'e-mail. */
export async function acceptEmailProposals(actor: UserActor, emailId: string, raw: AcceptEmailProposalInput[]) {
  const inputs = parseInput(acceptSchema, raw);
  return db.$transaction(async (tx) => {
    const email = await requireEmail(tx, emailId);
    if (!email.projectId) throw new ServiceError("Rattachez d’abord l’e-mail à un projet.");
    const projectId = email.projectId;

    const proposals = await tx.emailProposal.findMany({ where: { id: { in: inputs.map((input) => input.proposalId) }, emailId, status: "PENDING" } });
    const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]));
    const chosen = inputs.filter((input) => byId.has(input.proposalId));
    if (chosen.length === 0) throw new ServiceError("Ces actions ont déjà été traitées.", "CONFLICT");

    const assignees = new Set(
      (
        await tx.user.findMany({ where: { id: { in: chosen.flatMap((input) => (input.assigneeId ? [input.assigneeId] : [])) }, active: true }, select: { id: true } })
      ).map((user) => user.id),
    );

    let roundId = email.roundId;
    if (!roundId) {
      const contact = await tx.contact.findUnique({ where: { email: email.fromEmail }, select: { id: true } });
      const round = await tx.feedbackRound.create({
        data: {
          label: `${emailLabel(email.sentAt)} · ${email.subject}`.slice(0, 120),
          channel: "EMAIL",
          receivedAt: email.sentAt,
          projectId,
          fromContactId: contact?.id ?? null,
        },
        select: { id: true },
      });
      roundId = round.id;
      await tx.emailMessage.update({ where: { id: emailId }, data: { roundId } });
    }

    const label = emailLabel(email.sentAt);
    const sender = email.fromName ?? email.fromEmail;
    const drafts = chosen.map((input) => {
      const proposal = byId.get(input.proposalId)!;
      const evidence = `${label} (${sender})${NNBSP}: ${quote(proposal.quote)}`;
      const due = input.dueDate ? fromParisDateInput(input.dueDate) : null;
      return {
        title: input.title,
        description: proposal.description ? `${proposal.description}\n\n${evidence}` : evidence,
        zone: input.zone || null,
        assigneeId: input.assigneeId && assignees.has(input.assigneeId) ? input.assigneeId : null,
        dueDate: due && !Number.isNaN(due.getTime()) ? due : null,
        source: label,
      };
    });

    const { tasks, refs } = await createTasksTx(tx, { ...actor, via: "EMAIL" }, projectId, drafts, {
      roundId,
      activityMessage: `a créé ${plural(drafts.length, "tâche")} depuis l’e-mail ${quote(email.subject)}`,
    });
    const now = new Date();
    for (const [index, input] of chosen.entries()) {
      await tx.emailProposal.update({
        where: { id: input.proposalId },
        data: { status: "ACCEPTED", taskId: tasks[index].id, reviewedById: actor.userId, reviewedAt: now },
      });
    }
    await closeIfReviewed(tx, emailId);
    return { refs };
  });
}

/** « Rattacher à BG-12 » : la tâche existante reçoit la citation en commentaire. */
export async function linkEmailProposal(actor: UserActor, proposalId: string, ref: string) {
  const parsed = parseTaskRef(ref);
  if (!parsed) throw new ServiceError("Référence de tâche invalide (ex. BG-12).");
  return db.$transaction(async (tx) => {
    const proposal = await tx.emailProposal.findUnique({ where: { id: proposalId } });
    if (!proposal || proposal.status !== "PENDING") throw new ServiceError("Cette action a déjà été traitée.", "CONFLICT");
    const email = await requireEmail(tx, proposal.emailId);
    const task = await tx.task.findFirst({
      where: { number: parsed.number, project: { key: parsed.key }, ...(email.projectId ? { projectId: email.projectId } : {}) },
      select: { id: true, number: true, projectId: true },
    });
    if (!task) throw new ServiceError(`Aucune tâche ${parsed.key}-${parsed.number}${email.projectId ? " dans le projet de cet e-mail" : ""}.`, "NOT_FOUND");
    const reference = taskRef(parsed.key, task.number);
    const comment = await tx.comment.create({
      data: { taskId: task.id, authorId: actor.userId, body: `${emailLabel(email.sentAt)} de ${email.fromName ?? email.fromEmail}${NNBSP}: ${quote(proposal.quote)}` },
      select: { id: true, body: true },
    });
    await logActivity(tx, { projectId: task.projectId, actorId: actor.userId, taskId: task.id, message: `a commenté ${reference}` });
    await emitEvent(tx, { ...actor, via: "EMAIL" }, {
      type: "comment.created",
      projectId: task.projectId,
      taskId: task.id,
      payload: { ref: reference, commentId: comment.id, excerpt: comment.body.slice(0, 280) },
    });
    await tx.emailProposal.update({ where: { id: proposalId }, data: { status: "LINKED", taskId: task.id, reviewedById: actor.userId, reviewedAt: new Date() } });
    await closeIfReviewed(tx, email.id);
    return { ref: reference };
  });
}

/** « Ignorer », ou « Remettre » pour revenir sur un refus. */
export async function setEmailProposalIgnored(actor: UserActor, proposalId: string, ignored: boolean) {
  await db.$transaction(async (tx) => {
    const proposal = await tx.emailProposal.findUnique({ where: { id: proposalId } });
    if (!proposal) throw new ServiceError("Action introuvable.", "NOT_FOUND");
    if (proposal.status !== (ignored ? "PENDING" : "REJECTED")) return;
    await tx.emailProposal.update({
      where: { id: proposalId },
      data: ignored ? { status: "REJECTED", reviewedById: actor.userId, reviewedAt: new Date() } : { status: "PENDING", reviewedById: null, reviewedAt: null },
    });
    await closeIfReviewed(tx, proposal.emailId);
  });
}

/** « Relancer » une lecture en échec. */
export async function retryEmailAnalysis(emailId: string) {
  const email = await db.emailMessage.findUnique({ where: { id: emailId }, select: { analysis: true, bodyText: true } });
  if (!email) throw new ServiceError("E-mail introuvable.", "NOT_FOUND");
  if (email.analysis !== "FAILED") return;
  if (!email.bodyText) throw new ServiceError("Le texte de cet e-mail n’est plus conservé.");
  await db.emailMessage.update({ where: { id: emailId }, data: { analysis: "PENDING", analysisError: null } });
  await enqueueJob(EMAIL_JOBS.analyze, { emailId }, { dedupeKey: `email:${emailId}:${Date.now()}` });
}

/** Nom d'un contact créé depuis une adresse : le nom affiché, sinon « luna.cervi » → « Luna Cervi ». */
function contactName(email: string, name: string | null) {
  if (name?.trim()) return name.trim().slice(0, 120);
  return email
    .split("@")[0]
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("fr-FR") + part.slice(1))
    .join(" ")
    .slice(0, 120);
}

/**
 * Interlocuteur inconnu → contact d'un client (existant, ou créé pour lui).
 * Ses e-mails des 30 derniers jours sont relus pour être rattachés.
 */
export async function addSenderAsContact(senderEmail: string, target: { clientId: string } | { newClientName: string }) {
  const email = senderEmail.trim().toLowerCase();
  if (!isValidEmail(email)) throw new ServiceError("Adresse invalide.");
  const sender = await db.emailSender.findUnique({ where: { email } });
  try {
    await db.$transaction(async (tx) => {
      let clientId: string;
      if ("clientId" in target) {
        const client = await tx.client.findUnique({ where: { id: target.clientId }, select: { id: true } });
        if (!client) throw new ServiceError("Client introuvable.", "NOT_FOUND");
        clientId = client.id;
      } else {
        const name = target.newClientName.trim().slice(0, 120);
        if (!name) throw new ServiceError("Donnez un nom au client.");
        clientId = (await tx.client.create({ data: { name, kind: "DIRECT" }, select: { id: true } })).id;
      }
      const count = await tx.contact.count({ where: { clientId } });
      await tx.contact.create({ data: { name: contactName(email, sender?.name ?? null), email, clientId, isPrimary: count === 0 } });
      await tx.emailSender.deleteMany({ where: { email } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ServiceError("Un contact existe déjà avec cette adresse.", "CONFLICT");
    throw error;
  }
  await queueGmailSearch(`{from:${email} to:${email} cc:${email}} newer_than:30d`);
}

/** « Ignorer » un interlocuteur : il n'est plus proposé. */
export async function dismissSender(senderEmail: string) {
  await db.emailSender.updateMany({ where: { email: senderEmail.trim().toLowerCase() }, data: { dismissedAt: new Date() } });
}

/** Libellé pour l'interface : « 3 actions à revoir ». */
export const pendingLabel = (count: number) => plural(count, "action à revoir", "actions à revoir");
