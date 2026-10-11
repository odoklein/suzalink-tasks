import "server-only";

import type { Prisma } from "@prisma/client";
import { cache } from "react";

import { db } from "@/lib/db";
import { integrationEnabled } from "@/lib/env";
import type { Attendee } from "@/lib/meetings/drafts";
import { taskRef } from "@/lib/services/core";

/** Lectures des pages Réunions. La session est vérifiée par la page appelante. */

const listSelect = {
  id: true,
  title: true,
  startsAt: true,
  endsAt: true,
  platform: true,
  attendees: true,
  internalOnly: true,
  projectId: true,
  projectSuggestedBy: true,
  projectConfirmedAt: true,
  captureStatus: true,
  captureError: true,
  reportStatus: true,
  roundId: true,
  oauthAccount: { select: { userId: true, user: { select: { name: true } } } },
  _count: { select: { proposals: { where: { status: "PENDING" } } } },
} satisfies Prisma.MeetingSelect;

type ListRow = Prisma.MeetingGetPayload<{ select: typeof listSelect }>;

export type MeetingListItem = Omit<ListRow, "attendees" | "oauthAccount" | "_count"> & {
  attendees: Attendee[];
  ownerName: string | null;
  canManage: boolean;
  pendingProposals: number;
};

function toItem(row: ListRow, viewer: { id: string; isAdmin: boolean }): MeetingListItem {
  const { attendees, oauthAccount, _count, ...rest } = row;
  return {
    ...rest,
    attendees: attendees as unknown as Attendee[],
    ownerName: oauthAccount?.user.name ?? null,
    canManage: viewer.isAdmin || oauthAccount?.userId === viewer.id,
    pendingProposals: _count.proposals,
  };
}

/** À revoir (compte rendu prêt, en cours ou en échec), à venir, passées récentes. */
export async function listMeetings(viewer: { id: string; isAdmin: boolean }) {
  const now = new Date();
  const base = { deletedAt: null, cancelledAt: null } satisfies Prisma.MeetingWhereInput;
  const [review, upcoming, past] = await Promise.all([
    db.meeting.findMany({
      where: { ...base, reportStatus: { in: ["TRANSCRIBING", "EXTRACTING", "READY", "FAILED"] } },
      orderBy: { startsAt: "desc" },
      select: listSelect,
      take: 50,
    }),
    db.meeting.findMany({
      where: { ...base, endsAt: { gte: now }, reportStatus: "NONE" },
      orderBy: { startsAt: "asc" },
      select: listSelect,
      take: 200,
    }),
    db.meeting.findMany({
      where: { ...base, endsAt: { lt: now }, reportStatus: { in: ["NONE", "REVIEWED"] } },
      orderBy: { startsAt: "desc" },
      select: listSelect,
      take: 30,
    }),
  ]);
  return {
    review: review.map((row) => toItem(row, viewer)),
    upcoming: upcoming.map((row) => toItem(row, viewer)),
    past: past.map((row) => toItem(row, viewer)),
  };
}

/** Compte rendu complet d'une réunion. */
export async function getMeetingReport(meetingId: string, viewer: { id: string; isAdmin: boolean }) {
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    include: {
      project: { select: { id: true, name: true, slug: true, key: true, color: true, zones: { orderBy: { position: "asc" }, select: { name: true } } } },
      oauthAccount: { select: { userId: true, user: { select: { name: true } } } },
      captureApprovedBy: { select: { name: true } },
      segments: { orderBy: { index: "asc" }, select: { index: true, speaker: true, startMs: true, text: true } },
      proposals: {
        orderBy: { position: "asc" },
        include: { task: { select: { number: true, title: true, project: { select: { key: true } } } } },
      },
    },
  });
  if (!meeting || meeting.deletedAt) return null;

  const duplicateIds = meeting.proposals.flatMap((proposal) => (proposal.duplicateOfId ? [proposal.duplicateOfId] : []));
  const duplicates = duplicateIds.length
    ? await db.task.findMany({ where: { id: { in: duplicateIds } }, select: { id: true, number: true, title: true, project: { select: { key: true } } } })
    : [];
  const duplicateById = new Map(duplicates.map((task) => [task.id, { ref: taskRef(task.project.key, task.number), title: task.title }]));

  return {
    ...meeting,
    attendees: meeting.attendees as unknown as Attendee[],
    ownerName: meeting.oauthAccount?.user.name ?? null,
    canManage: viewer.isAdmin || meeting.oauthAccount?.userId === viewer.id,
    proposals: meeting.proposals.map((proposal) => ({
      ...proposal,
      task: proposal.task ? { ref: taskRef(proposal.task.project.key, proposal.task.number), title: proposal.task.title } : null,
      duplicate: proposal.duplicateOfId ? (duplicateById.get(proposal.duplicateOfId) ?? null) : null,
    })),
  };
}

export type MeetingReport = NonNullable<Awaited<ReturnType<typeof getMeetingReport>>>;
export type MeetingProposalView = MeetingReport["proposals"][number];

/** Compte Google du membre (Paramètres, bandeau des Réunions). */
export const getGoogleConnection = cache(async (userId: string) => {
  if (!integrationEnabled("google")) return { enabled: false as const };
  const account = await db.oAuthAccount.findUnique({
    where: { userId_provider: { userId, provider: "google" } },
    select: { email: true, calendarSyncedAt: true, lastError: true, reconnectRequired: true, createdAt: true },
  });
  return { enabled: true as const, account };
});

/** Comptes rendus à revoir (Aujourd'hui, barre latérale). */
export function countReportsToReview() {
  return db.meeting.count({ where: { deletedAt: null, reportStatus: "READY" } });
}
