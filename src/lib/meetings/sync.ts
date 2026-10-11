import "server-only";

import type { OAuthAccount, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { accessTokenFor } from "@/lib/google/accounts";
import { getEvent, listEvents } from "@/lib/google/calendar";
import { GoogleAuthError } from "@/lib/google/oauth";
import { recordIntegrationSignal } from "@/lib/integration-status";
import { cancelMeetingCapture, scheduleDispatch } from "@/lib/meetings/capture";
import { getEnv } from "@/lib/env";
import type { Agency } from "@/lib/meetings/agency";
import { toMeetingDraft, type MeetingDraft } from "@/lib/meetings/drafts";
import { suggestProject, type MatchContact, type MatchProject } from "@/lib/meetings/matching";

/** Fenêtre relue à chaque passage : de 6 h en arrière (réunions qui viennent de finir) à 30 jours. */
const WINDOW_BACK_MS = 6 * 3600_000;
const WINDOW_AHEAD_MS = 30 * 24 * 3600_000;

type MatchContext = { contacts: MatchContact[]; projects: MatchProject[]; agency: Agency };

async function matchContext(): Promise<MatchContext> {
  const [contacts, projects, members, accounts] = await Promise.all([
    db.contact.findMany({ where: { email: { not: null } }, select: { email: true, clientId: true } }),
    db.project.findMany({
      where: { archived: false, status: { not: "DONE" } },
      select: { id: true, key: true, name: true, clientId: true },
    }),
    db.user.findMany({ select: { email: true } }),
    db.oAuthAccount.findMany({ select: { email: true } }),
  ]);
  const memberEmails = new Set([...members, ...accounts].map((row) => row.email.toLowerCase()));
  return { contacts, projects, agency: { domain: getEnv().AGENCY_DOMAIN, memberEmails } };
}

function linkFields(draft: MeetingDraft) {
  return {
    title: draft.title.slice(0, 300),
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    iCalUid: draft.iCalUid,
    attendees: draft.attendees as unknown as Prisma.InputJsonValue,
    internalOnly: draft.internalOnly,
    platform: draft.link?.platform ?? null,
    joinUrl: draft.link?.url ?? null,
    nativeMeetingId: draft.link?.nativeMeetingId ?? null,
    passcode: draft.link?.passcode ?? null,
    cancelledAt: null,
  };
}

/**
 * Crée ou met à jour la réunion d'un événement. Un même événement peut être
 * dans l'agenda de plusieurs membres : une seule réunion (même iCalUID et même
 * début, ou même salle et même début), sinon deux robots partiraient.
 */
async function upsertMeeting(account: OAuthAccount, draft: MeetingDraft, context: MatchContext) {
  const existing = await db.meeting.findUnique({
    where: { oauthAccountId_calendarEventId: { oauthAccountId: account.id, calendarEventId: draft.calendarEventId } },
    select: { id: true, startsAt: true, captureStatus: true },
  });

  if (existing) {
    await db.meeting.update({ where: { id: existing.id }, data: linkFields(draft) });
    // Réunion déplacée alors que l'enregistrement est validé : nouvel envoi à la nouvelle heure.
    if (existing.captureStatus === "APPROVED" && existing.startsAt.getTime() !== draft.startsAt.getTime()) {
      await scheduleDispatch(existing.id, draft.startsAt);
    }
    return;
  }

  const sameMeeting: Prisma.MeetingWhereInput[] = [];
  if (draft.iCalUid) sameMeeting.push({ iCalUid: draft.iCalUid });
  if (draft.link) sameMeeting.push({ nativeMeetingId: draft.link.nativeMeetingId });
  const shared = sameMeeting.length
    ? await db.meeting.findFirst({
        where: { startsAt: draft.startsAt, OR: sameMeeting },
        select: { id: true, oauthAccountId: true },
      })
    : null;
  if (shared) {
    // Déjà suivie par un autre membre ; reprise si son agenda a été déconnecté.
    if (!shared.oauthAccountId) {
      await db.meeting.update({
        where: { id: shared.id },
        data: { ...linkFields(draft), oauthAccountId: account.id, calendarEventId: draft.calendarEventId },
      });
    }
    return;
  }

  const suggestion = suggestProject(
    { title: draft.title, attendeeEmails: draft.attendees.map((attendee) => attendee.email) },
    context.contacts,
    context.projects,
    context.agency,
  );
  await db.meeting.create({
    data: {
      ...linkFields(draft),
      oauthAccountId: account.id,
      calendarEventId: draft.calendarEventId,
      projectId: suggestion?.projectId ?? null,
      projectSuggestedBy: suggestion?.by ?? null,
    },
  });
}

async function markCancelled(accountId: string, calendarEventId: string) {
  const meeting = await db.meeting.findUnique({
    where: { oauthAccountId_calendarEventId: { oauthAccountId: accountId, calendarEventId } },
    select: { id: true, cancelledAt: true },
  });
  if (!meeting || meeting.cancelledAt) return;
  await db.meeting.update({ where: { id: meeting.id }, data: { cancelledAt: new Date() } });
  await cancelMeetingCapture(meeting.id, "Réunion annulée dans l’agenda.");
}

/**
 * Gardée : une visio que le robot peut rejoindre, ou un rendez-vous avec un
 * invité extérieur (téléphone, sur place), utile pour suivre le client même
 * sans enregistrement. Un créneau interne sans lien (déjeuner…) est ignoré.
 */
const isWorthKeeping = (draft: MeetingDraft) => !!draft.link || !draft.internalOnly;

/** Relit la fenêtre de l'agenda principal d'un compte. */
export async function syncAccount(account: OAuthAccount) {
  const token = await accessTokenFor(account);
  const now = Date.now();
  const from = new Date(now - WINDOW_BACK_MS);
  const to = new Date(now + WINDOW_AHEAD_MS);
  const events = await listEvents(token, from, to);
  const context = await matchContext();

  const seen = new Set<string>();
  for (const event of events) {
    const result = toMeetingDraft(event, context.agency);
    if (result.kind === "ignored") continue;
    seen.add(event.id);
    if (result.kind === "cancelled") await markCancelled(account.id, event.id);
    else if (isWorthKeeping(result.draft)) await upsertMeeting(account, result.draft, context);
  }

  // Réunions suivies qui ne sont plus dans la liste : déplacées hors de la fenêtre, ou supprimées.
  const missing = await db.meeting.findMany({
    where: {
      oauthAccountId: account.id,
      cancelledAt: null,
      startsAt: { gte: from, lte: to },
      calendarEventId: { notIn: [...seen] },
    },
    select: { calendarEventId: true },
  });
  for (const { calendarEventId } of missing) {
    if (!calendarEventId) continue;
    const event = await getEvent(token, calendarEventId);
    const result = event ? toMeetingDraft(event, context.agency) : null;
    if (result?.kind === "meeting" && isWorthKeeping(result.draft)) await upsertMeeting(account, result.draft, context);
    else await markCancelled(account.id, calendarEventId);
  }

  await db.oAuthAccount.update({
    where: { id: account.id },
    data: { calendarSyncedAt: new Date(), lastError: null, lastErrorAt: null },
  });
}

/** Travail `calendar_sync` : un compte (juste après la connexion) ou tous ceux qui sont valides. */
export async function syncCalendars(accountId?: string) {
  const accounts = await db.oAuthAccount.findMany({
    where: { provider: "google", reconnectRequired: false, ...(accountId ? { id: accountId } : {}) },
  });
  const errors: string[] = [];
  for (const account of accounts) {
    try {
      await syncAccount(account);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${account.email} : ${message}`);
      if (!(error instanceof GoogleAuthError)) {
        await db.oAuthAccount.update({ where: { id: account.id }, data: { lastError: message.slice(0, 500), lastErrorAt: new Date() } });
      }
    }
  }
  if (accounts.length > 0) {
    await recordIntegrationSignal("google", errors.length ? { ok: false, error: errors.join(" · ") } : { ok: true });
  }
}
