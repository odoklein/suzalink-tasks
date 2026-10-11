import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { isSenderWorthSuggesting, suggestedClientName } from "@/lib/emails/routing";
import { taskRef } from "@/lib/services/core";

/** Lectures des pages E-mails. La session est vérifiée par la page appelante. */

const rowSelect = {
  id: true,
  direction: true,
  fromEmail: true,
  fromName: true,
  toEmails: true,
  subject: true,
  snippet: true,
  sentAt: true,
  analysis: true,
  meetingLink: true,
  clientId: true,
  projectId: true,
  client: { select: { name: true } },
  _count: { select: { proposals: { where: { status: "PENDING" } } } },
} satisfies Prisma.EmailMessageSelect;

export type EmailRow = Prisma.EmailMessageGetPayload<{ select: typeof rowSelect }>;

export async function listEmails(filter: { clientId?: string | null }) {
  const [review, recent, senders] = await Promise.all([
    db.emailMessage.findMany({
      where: { analysis: { in: ["PENDING", "READY", "FAILED"] } },
      orderBy: { sentAt: "desc" },
      select: rowSelect,
      take: 50,
    }),
    db.emailMessage.findMany({
      where: filter.clientId ? { clientId: filter.clientId } : {},
      orderBy: { sentAt: "desc" },
      select: rowSelect,
      take: 60,
    }),
    db.emailSender.findMany({
      where: { dismissedAt: null, received: { gte: 1 }, sent: { gte: 1 } },
      orderBy: { lastSeenAt: "desc" },
      take: 30,
    }),
  ]);
  return {
    review,
    recent,
    senders: senders.filter(isSenderWorthSuggesting).map((sender) => ({ ...sender, suggestedName: suggestedClientName(sender) })),
  };
}

export type SenderSuggestion = Awaited<ReturnType<typeof listEmails>>["senders"][number];

/** Un e-mail, ses actions proposées et la réunion qui en vient. */
export async function getEmailDetail(emailId: string) {
  const email = await db.emailMessage.findUnique({
    where: { id: emailId },
    include: {
      client: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, slug: true, key: true, color: true, zones: { orderBy: { position: "asc" }, select: { name: true } } } },
      oauthAccount: { select: { email: true, user: { select: { name: true } } } },
      proposals: {
        orderBy: { position: "asc" },
        include: { task: { select: { number: true, title: true, project: { select: { key: true } } } } },
      },
    },
  });
  if (!email) return null;

  const duplicateIds = email.proposals.flatMap((proposal) => (proposal.duplicateOfId ? [proposal.duplicateOfId] : []));
  const [duplicates, meeting] = await Promise.all([
    duplicateIds.length
      ? db.task.findMany({ where: { id: { in: duplicateIds } }, select: { id: true, number: true, title: true, project: { select: { key: true } } } })
      : [],
    db.meeting.findFirst({ where: { emailMessageId: emailId, deletedAt: null }, select: { id: true, title: true, startsAt: true, confirmedAt: true, source: true } }),
  ]);
  const duplicateById = new Map(duplicates.map((task) => [task.id, { ref: taskRef(task.project.key, task.number), title: task.title }]));

  return {
    ...email,
    meeting,
    proposals: email.proposals.map((proposal) => ({
      ...proposal,
      task: proposal.task ? { ref: taskRef(proposal.task.project.key, proposal.task.number), title: proposal.task.title } : null,
      duplicate: proposal.duplicateOfId ? (duplicateById.get(proposal.duplicateOfId) ?? null) : null,
    })),
  };
}

/** Clients et projets pour corriger un rattachement. */
export async function routingOptions() {
  const [clients, projects] = await Promise.all([
    db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.project.findMany({ where: { archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true, key: true, color: true, clientId: true } }),
  ]);
  return { clients, projects };
}

export type RoutingOptions = Awaited<ReturnType<typeof routingOptions>>;
