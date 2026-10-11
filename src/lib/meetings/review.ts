import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import { enqueueJob } from "@/lib/jobs/queue";
import { cancelMeetingCapture } from "@/lib/meetings/capture";
import { MEETING_JOBS, reportKey, transcriptKey } from "@/lib/meetings/job-kinds";
import { isLive } from "@/lib/meetings/vexa-status";
import { deleteRecording, vexaEnabled } from "@/lib/meetings/vexa";
import { NNBSP, quote } from "@/lib/fr";
import { plural } from "@/lib/plural";
import { logActivity } from "@/lib/services/activity";
import { parseInput, parseTaskRef, ServiceError, taskRef, type Actor, type Tx } from "@/lib/services/core";
import { emitEvent, emitEvents } from "@/lib/services/outbox";
import { createTasksTx } from "@/lib/services/tasks";
import { formatParis, fromParisDateInput } from "@/lib/time";
import { idSchema, titleSchema } from "@/lib/validation";

/**
 * Revue du compte rendu : chaque action proposée est créée, rattachée à une
 * tâche existante ou ignorée, par un membre. La tâche créée garde sa preuve
 * (citation, moment de la réunion) et son lot « Réunion du 12/10 ».
 */

type UserActor = Actor & { userId: string };

const clock = (ms: number) => `${String(Math.floor(ms / 60_000)).padStart(2, "0")}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, "0")}`;

const meetingLabel = (startsAt: Date) => `Réunion du ${formatParis(startsAt, "dd/MM")}`;

async function requireMeeting(tx: Tx, meetingId: string) {
  const meeting = await tx.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting || meeting.deletedAt) throw new ServiceError("Réunion introuvable.", "NOT_FOUND");
  return meeting;
}

/** Plus rien à revoir : le compte rendu passe à « Traité ». */
async function closeIfReviewed(tx: Tx, meetingId: string) {
  const pending = await tx.meetingProposal.count({ where: { meetingId, status: "PENDING" } });
  await tx.meeting.update({ where: { id: meetingId }, data: { reportStatus: pending === 0 ? "REVIEWED" : "READY" } });
}

/** Associe la réunion à un projet (ou la détache), tant qu'aucune tâche n'en est issue. */
export async function setMeetingProject(actor: UserActor, meetingId: string, projectId: string | null) {
  await db.$transaction(async (tx) => {
    const meeting = await requireMeeting(tx, meetingId);
    if (meeting.roundId && meeting.projectId !== projectId) {
      throw new ServiceError("Des tâches ont déjà été créées depuis cette réunion : le projet ne peut plus changer.", "CONFLICT");
    }
    if (projectId) {
      const project = await tx.project.findUnique({ where: { id: projectId }, select: { archived: true } });
      if (!project || project.archived) throw new ServiceError("Projet introuvable.", "NOT_FOUND");
    }
    await tx.meeting.update({
      where: { id: meetingId },
      data: {
        projectId,
        projectConfirmedAt: projectId ? new Date() : null,
        projectSuggestedBy: projectId === meeting.projectId ? meeting.projectSuggestedBy : projectId ? "manuel" : null,
      },
    });
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
export type AcceptProposalInput = z.input<typeof acceptSchema>[number];

/** « Créer les tâches » : une tâche par action choisie, dans le lot de la réunion. */
export async function acceptProposals(actor: UserActor, meetingId: string, raw: AcceptProposalInput[]) {
  const inputs = parseInput(acceptSchema, raw);
  return db.$transaction(async (tx) => {
    const meeting = await requireMeeting(tx, meetingId);
    if (!meeting.projectId) throw new ServiceError("Associez d’abord la réunion à un projet.");
    const projectId = meeting.projectId;

    const proposals = await tx.meetingProposal.findMany({
      where: { id: { in: inputs.map((input) => input.proposalId) }, meetingId, status: "PENDING" },
    });
    const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]));
    const chosen = inputs.filter((input) => byId.has(input.proposalId));
    if (chosen.length === 0) throw new ServiceError("Ces actions ont déjà été traitées.", "CONFLICT");

    const assignees = new Set(
      (
        await tx.user.findMany({
          where: { id: { in: chosen.flatMap((input) => (input.assigneeId ? [input.assigneeId] : [])) }, active: true },
          select: { id: true },
        })
      ).map((user) => user.id),
    );
    const segments = new Map(
      (
        await tx.meetingSegment.findMany({
          where: { meetingId, index: { in: proposals.flatMap((proposal) => proposal.segmentIndexes) } },
          select: { index: true, startMs: true, speaker: true },
        })
      ).map((segment) => [segment.index, segment]),
    );

    let roundId = meeting.roundId;
    if (!roundId) {
      const round = await tx.feedbackRound.create({
        data: {
          label: `${meetingLabel(meeting.startsAt)} · ${meeting.title}`.slice(0, 120),
          channel: "CALL",
          receivedAt: meeting.startsAt,
          projectId,
        },
        select: { id: true },
      });
      roundId = round.id;
      await tx.meeting.update({ where: { id: meetingId }, data: { roundId } });
    }

    const label = meetingLabel(meeting.startsAt);
    const drafts = chosen.map((input) => {
      const proposal = byId.get(input.proposalId)!;
      const first = segments.get(proposal.segmentIndexes[0]);
      const said = first ? ` (${first.speaker ? `${first.speaker}, ` : ""}${clock(first.startMs)})` : "";
      const evidence = `${label}${said}${NNBSP}: ${quote(proposal.quote)}`;
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

    const { tasks, refs } = await createTasksTx(tx, actor, projectId, drafts, {
      roundId,
      activityMessage: `a créé ${plural(drafts.length, "tâche")} depuis la réunion ${quote(meeting.title)}`,
    });

    const now = new Date();
    for (const [index, input] of chosen.entries()) {
      await tx.meetingProposal.update({
        where: { id: input.proposalId },
        data: { status: "ACCEPTED", taskId: tasks[index].id, reviewedById: actor.userId, reviewedAt: now },
      });
    }
    await emitEvents(
      tx,
      actor,
      chosen.map((input, index) => ({
        type: "meeting.proposal_reviewed" as const,
        projectId,
        taskId: tasks[index].id,
        payload: { meetingId, proposalId: input.proposalId, status: "ACCEPTED", ref: refs[index] },
      })),
    );
    await closeIfReviewed(tx, meetingId);
    return { refs };
  });
}

/** « Rattacher à BG-12 » : la tâche existante reçoit la citation en commentaire. */
export async function linkProposal(actor: UserActor, proposalId: string, ref: string) {
  const parsed = parseTaskRef(ref);
  if (!parsed) throw new ServiceError("Référence de tâche invalide (ex. BG-12).");
  return db.$transaction(async (tx) => {
    const proposal = await tx.meetingProposal.findUnique({ where: { id: proposalId } });
    if (!proposal || proposal.status !== "PENDING") throw new ServiceError("Cette action a déjà été traitée.", "CONFLICT");
    const meeting = await requireMeeting(tx, proposal.meetingId);
    if (!meeting.projectId) throw new ServiceError("Associez d’abord la réunion à un projet.");
    const task = await tx.task.findFirst({
      where: { number: parsed.number, project: { key: parsed.key }, projectId: meeting.projectId },
      select: { id: true, number: true, projectId: true },
    });
    if (!task) throw new ServiceError(`Aucune tâche ${parsed.key}-${parsed.number} dans le projet de cette réunion.`, "NOT_FOUND");
    const taskReference = taskRef(parsed.key, task.number);

    const comment = await tx.comment.create({
      data: { taskId: task.id, authorId: actor.userId, body: `Évoqué en réunion (${meetingLabel(meeting.startsAt).toLowerCase()}, ${quote(meeting.title)})${NNBSP}: ${quote(proposal.quote)}` },
      select: { id: true, body: true },
    });
    await logActivity(tx, { projectId: task.projectId, actorId: actor.userId, taskId: task.id, message: `a commenté ${taskReference}` });
    await emitEvent(tx, actor, {
      type: "comment.created",
      projectId: task.projectId,
      taskId: task.id,
      payload: { ref: taskReference, commentId: comment.id, excerpt: comment.body.slice(0, 280) },
    });
    await tx.meetingProposal.update({
      where: { id: proposalId },
      data: { status: "LINKED", taskId: task.id, reviewedById: actor.userId, reviewedAt: new Date() },
    });
    await emitEvent(tx, actor, {
      type: "meeting.proposal_reviewed",
      projectId: task.projectId,
      taskId: task.id,
      payload: { meetingId: meeting.id, proposalId, status: "LINKED", ref: taskReference },
    });
    await closeIfReviewed(tx, meeting.id);
    return { ref: taskReference };
  });
}

/** « Ignorer », ou « Annuler » pour revenir sur un refus. */
export async function setProposalIgnored(actor: UserActor, proposalId: string, ignored: boolean) {
  await db.$transaction(async (tx) => {
    const proposal = await tx.meetingProposal.findUnique({ where: { id: proposalId } });
    if (!proposal) throw new ServiceError("Action introuvable.", "NOT_FOUND");
    if (proposal.status !== (ignored ? "PENDING" : "REJECTED")) return;
    const meeting = await requireMeeting(tx, proposal.meetingId);
    await tx.meetingProposal.update({
      where: { id: proposalId },
      data: ignored ? { status: "REJECTED", reviewedById: actor.userId, reviewedAt: new Date() } : { status: "PENDING", reviewedById: null, reviewedAt: null },
    });
    await emitEvent(tx, actor, {
      type: "meeting.proposal_reviewed",
      projectId: meeting.projectId,
      payload: { meetingId: meeting.id, proposalId, status: ignored ? "REJECTED" : "PENDING", ref: null },
    });
    await closeIfReviewed(tx, meeting.id);
  });
}

/** « Relancer » un compte rendu en échec : transcription d'abord si elle manque. */
export async function retryReport(meetingId: string) {
  const meeting = await db.meeting.findUnique({ where: { id: meetingId }, select: { reportStatus: true, captureExternalId: true, deletedAt: true } });
  if (!meeting || meeting.deletedAt) throw new ServiceError("Réunion introuvable.", "NOT_FOUND");
  if (meeting.reportStatus !== "FAILED") return;
  const hasTranscript = (await db.meetingSegment.count({ where: { meetingId } })) > 0;
  if (!hasTranscript && !meeting.captureExternalId) throw new ServiceError("Aucun enregistrement pour cette réunion.");
  await db.meeting.update({ where: { id: meetingId }, data: { reportStatus: hasTranscript ? "EXTRACTING" : "TRANSCRIBING", reportError: null } });
  await enqueueJob(
    hasTranscript ? MEETING_JOBS.report : MEETING_JOBS.transcript,
    { meetingId },
    { dedupeKey: hasTranscript ? reportKey(meetingId, Date.now()) : transcriptKey(meetingId, Date.now()) },
  );
}

/**
 * « Supprimer la réunion » : enregistrement, transcription et compte rendu
 * effacés. Les tâches déjà créées restent (avec leur citation). La ligne est
 * gardée, vide, pour que la synchronisation de l'agenda ne la recrée pas.
 */
export async function deleteMeetingContent(actor: UserActor, meetingId: string) {
  const [user, meeting] = await Promise.all([
    db.user.findUnique({ where: { id: actor.userId }, select: { role: true } }),
    db.meeting.findUnique({ where: { id: meetingId }, include: { oauthAccount: { select: { userId: true } } } }),
  ]);
  if (!meeting || meeting.deletedAt) throw new ServiceError("Réunion introuvable.", "NOT_FOUND");
  if (user?.role !== "ADMIN" && meeting.oauthAccount?.userId !== actor.userId) {
    throw new ServiceError("Seul le membre invité à cette réunion, ou un administrateur, peut la supprimer.", "FORBIDDEN");
  }
  if (isLive(meeting.captureStatus) || meeting.captureStatus === "APPROVED") await cancelMeetingCapture(meetingId, null, actor);
  if (meeting.recordingKey && !meeting.recordingPurgedAt && vexaEnabled()) await deleteRecording(Number(meeting.recordingKey));

  await db.$transaction(async (tx) => {
    await tx.meetingSegment.deleteMany({ where: { meetingId } });
    await tx.meetingProposal.deleteMany({ where: { meetingId, status: { in: ["PENDING", "REJECTED"] } } });
    await tx.meeting.update({
      where: { id: meetingId },
      data: {
        deletedAt: new Date(),
        summary: null,
        decisions: [],
        openQuestions: [],
        reportStatus: "NONE",
        captureStatus: meeting.captureStatus === "OFF" ? "OFF" : "CANCELLED",
        recordingPurgedAt: meeting.recordingKey ? new Date() : null,
        segmentsPurgedAt: new Date(),
      },
    });
    await emitEvent(tx, actor, { type: "meeting.deleted", projectId: meeting.projectId, payload: { meetingId, title: meeting.title } });
  });
}
