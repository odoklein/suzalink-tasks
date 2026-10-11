import "server-only";

import type { Job } from "@prisma/client";

import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { enqueueJob } from "@/lib/jobs/queue";
import { dispatchKey, MEETING_JOBS, pollKey, transcriptKey } from "@/lib/meetings/job-kinds";
import { captureStatusFrom, isLive } from "@/lib/meetings/vexa-status";
import { getVexaMeeting, runningBots, sendBot, stopBot, VexaError, vexaEnabled } from "@/lib/meetings/vexa";
import { ServiceError, type Actor } from "@/lib/services/core";
import { emitEvent } from "@/lib/services/outbox";

/**
 * Enregistrement d'une réunion par le robot : validation humaine, envoi juste
 * avant le début, suivi minute par minute, fin. Rien ne part sans validation,
 * et l'envoi revérifie tout au dernier moment.
 */

/** Marge après la fin prévue avant de faire sortir le robot d'office. */
const OVERTIME_MS = 30 * 60_000;

/** Le robot part 2 minutes avant le début (R4). */
export const BOT_LEAD_MS = 2 * 60_000;

/** Programme l'envoi du robot ; une réunion déplacée reçoit un nouveau travail (clé liée à l'heure). */
export async function scheduleDispatch(meetingId: string, startsAt: Date) {
  const runAt = new Date(Math.max(Date.now(), startsAt.getTime() - BOT_LEAD_MS));
  await enqueueJob(MEETING_JOBS.dispatch, { meetingId, startsAt: startsAt.toISOString() }, { runAt, dedupeKey: dispatchKey(meetingId, startsAt) });
}

/** Le membre dont l'agenda porte la réunion, ou un administrateur (R5). */
async function requireCaptureRights(userId: string, meetingId: string) {
  const [user, meeting] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { role: true } }),
    db.meeting.findUnique({ where: { id: meetingId }, include: { oauthAccount: { select: { userId: true } } } }),
  ]);
  if (!meeting) throw new ServiceError("Réunion introuvable.", "NOT_FOUND");
  if (user?.role !== "ADMIN" && meeting.oauthAccount?.userId !== userId) {
    throw new ServiceError("Seul le membre invité à cette réunion, ou un administrateur, peut décider de l’enregistrer.", "FORBIDDEN");
  }
  return meeting;
}

async function schedulePoll(meetingId: string, delayMs = 60_000) {
  const runAt = new Date(Date.now() + delayMs);
  await enqueueJob(MEETING_JOBS.poll, { meetingId }, { runAt, dedupeKey: pollKey(meetingId, runAt) });
}

/** « Enregistrer cette réunion » : validation, puis envoi programmé 2 minutes avant le début. */
export async function approveCapture(actor: Actor & { userId: string }, meetingId: string) {
  if (!vexaEnabled()) throw new ServiceError("Le serveur d’enregistrement n’est pas configuré (VEXA_API_URL, VEXA_API_KEY).");
  const meeting = await requireCaptureRights(actor.userId, meetingId);
  if (meeting.cancelledAt || meeting.deletedAt) throw new ServiceError("Cette réunion a été annulée.");
  if (meeting.source === "email" && !meeting.confirmedAt) throw new ServiceError("Confirmez d’abord cette réunion trouvée dans un e-mail.");
  if (meeting.endsAt.getTime() < Date.now()) throw new ServiceError("Cette réunion est terminée.");
  if (!meeting.platform || !meeting.nativeMeetingId || !meeting.joinUrl) {
    throw new ServiceError("Aucun lien Google Meet, Teams ou Zoom reconnu dans l’invitation.");
  }
  if (!["OFF", "CANCELLED", "FAILED"].includes(meeting.captureStatus)) return;

  await db.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: meetingId },
      data: {
        captureStatus: "APPROVED",
        captureApprovedById: actor.userId,
        captureApprovedAt: new Date(),
        captureError: null,
        captureExternalId: null,
      },
    });
    await emitEvent(tx, actor, {
      type: "meeting.capture_approved",
      projectId: meeting.projectId,
      payload: { meetingId, title: meeting.title, startsAt: meeting.startsAt.toISOString() },
    });
  });
  await scheduleDispatch(meetingId, meeting.startsAt);
}

/**
 * « Ne pas enregistrer » ou « Arrêter et ne rien garder » : le robot sort s'il
 * est entré, et rien de ce qu'il a capté n'est transcrit.
 */
export async function withdrawCapture(actor: Actor & { userId: string }, meetingId: string) {
  await requireCaptureRights(actor.userId, meetingId);
  await cancelMeetingCapture(meetingId, null, actor);
}

/** Retire l'enregistrement (validation retirée, réunion annulée, agenda déconnecté). */
export async function cancelMeetingCapture(meetingId: string, reason: string | null, actor: Actor = { userId: null, via: "SYSTEM" }) {
  const meeting = await db.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting || !(meeting.captureStatus === "APPROVED" || isLive(meeting.captureStatus))) return;
  if (isLive(meeting.captureStatus) && meeting.platform && meeting.nativeMeetingId && vexaEnabled()) {
    await stopBot(meeting.platform, meeting.nativeMeetingId);
  }
  await db.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: meetingId },
      data: { captureStatus: "CANCELLED", captureError: reason, leftAt: isLive(meeting.captureStatus) ? new Date() : meeting.leftAt },
    });
    await emitEvent(tx, actor, { type: "meeting.capture_cancelled", projectId: meeting.projectId, payload: { meetingId, title: meeting.title } });
  });
}

async function markFailed(meetingId: string, error: string) {
  await db.$transaction(async (tx) => {
    const meeting = await tx.meeting.update({
      where: { id: meetingId },
      data: { captureStatus: "FAILED", captureError: error, leftAt: new Date() },
      select: { title: true, projectId: true },
    });
    await emitEvent(tx, { userId: null, via: "SYSTEM" }, {
      type: "meeting.capture_failed",
      projectId: meeting.projectId,
      payload: { meetingId, title: meeting.title, error },
    });
  });
}

/** Travail `meeting_dispatch` : envoie le robot si tout est encore valable. */
export async function dispatchBot(job: Job) {
  const { meetingId, startsAt } = job.payload as { meetingId: string; startsAt: string };
  const meeting = await db.meeting.findUnique({ where: { id: meetingId } });
  // Validation retirée, réunion annulée ou déplacée (un autre travail porte la nouvelle heure) : rien à faire.
  if (!meeting || meeting.captureStatus !== "APPROVED" || meeting.cancelledAt) return;
  if (meeting.startsAt.toISOString() !== startsAt) return;
  if (meeting.endsAt.getTime() < Date.now()) return markFailed(meetingId, "La réunion s’est terminée avant l’envoi du robot.");
  if (!meeting.platform || !meeting.nativeMeetingId || !meeting.joinUrl) return markFailed(meetingId, "Lien de réunion manquant.");

  const transcribeLive = getEnv().MEETING_TRANSCRIPTION === "vexa";
  const sameMeeting = (bot: { native_meeting_id: string }) => bot.native_meeting_id === meeting.nativeMeetingId;

  // Une tentative précédente a pu créer le robot sans recevoir la réponse : on vérifie avant d'en envoyer un autre.
  let bot = (await runningBots()).find(sameMeeting);
  if (!bot) {
    try {
      bot = await sendBot({
        platform: meeting.platform,
        nativeMeetingId: meeting.nativeMeetingId,
        url: meeting.joinUrl,
        passcode: meeting.passcode,
        transcribeLive,
      });
    } catch (error) {
      if (error instanceof VexaError && error.status === 409) bot = (await runningBots()).find(sameMeeting);
      else if (error instanceof VexaError && error.status === 503) {
        return markFailed(meetingId, "La transcription n’est pas disponible sur le serveur d’enregistrement.");
      } else if (error instanceof VexaError && error.status === 422) {
        return markFailed(meetingId, "Le serveur d’enregistrement n’a pas accepté ce lien de réunion.");
      } else throw error;
      if (!bot) throw error;
    }
  }

  await db.meeting.update({
    where: { id: meetingId },
    data: { captureStatus: "JOINING", captureExternalId: String(bot.id), captureError: null },
  });
  await schedulePoll(meetingId);
}

/** Travail `meeting_poll` : suit le robot jusqu'à sa sortie, puis lance la transcription. */
export async function pollCapture(job: Job) {
  const { meetingId } = job.payload as { meetingId: string };
  const meeting = await db.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting || !isLive(meeting.captureStatus) || !meeting.captureExternalId) return;

  const state = captureStatusFrom(await getVexaMeeting(Number(meeting.captureExternalId)));
  if (!state || isLive(state.status)) {
    if (state && state.status !== meeting.captureStatus) {
      await db.meeting.update({
        where: { id: meetingId },
        data: { captureStatus: state.status, joinedAt: state.status === "RECORDING" ? (meeting.joinedAt ?? new Date()) : meeting.joinedAt },
      });
    }
    // Filet de sécurité : le robot ne reste pas indéfiniment après la fin prévue.
    if (Date.now() > meeting.endsAt.getTime() + OVERTIME_MS && meeting.platform && meeting.nativeMeetingId) {
      await stopBot(meeting.platform, meeting.nativeMeetingId);
    }
    await schedulePoll(meetingId);
    return;
  }

  if (state.status === "FAILED") return markFailed(meetingId, state.error ?? "Le robot n’a pas pu enregistrer la réunion.");

  await db.meeting.update({
    where: { id: meetingId },
    data: { captureStatus: "ENDED", leftAt: new Date(), reportStatus: "TRANSCRIBING", reportError: null },
  });
  // La transcription met parfois une minute à se finaliser chez Vexa.
  await enqueueJob(MEETING_JOBS.transcript, { meetingId }, { runAt: new Date(Date.now() + 60_000), dedupeKey: transcriptKey(meetingId) });
}

/** Travail récurrent `meeting_watch` : relance le suivi d'un robot dont la chaîne de suivi s'est interrompue. */
export async function watchLiveCaptures() {
  const live = await db.meeting.findMany({
    where: { captureStatus: { in: ["JOINING", "WAITING_ADMISSION", "RECORDING"] } },
    select: { id: true },
  });
  for (const meeting of live) await schedulePoll(meeting.id, 0);
}
