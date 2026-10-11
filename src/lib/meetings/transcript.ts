import "server-only";

import type { Job } from "@prisma/client";

import { biasTerms, transcribeAudio, TRANSCRIPTION_MODEL } from "@/lib/ai/mistral";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { enqueueJob } from "@/lib/jobs/queue";
import { MAX_ATTEMPTS } from "@/lib/jobs/schedule";
import { MEETING_JOBS, reportKey } from "@/lib/meetings/job-kinds";
import { getAudioRecording, getTranscript } from "@/lib/meetings/vexa";

/**
 * Travail `meeting_transcript` : récupère la transcription (Vexa en direct,
 * ou Voxtral sur l'enregistrement, selon MEETING_TRANSCRIPTION), l'écrit en
 * passages numérotés, puis lance le compte rendu.
 */

type Line = { speaker: string | null; startMs: number; endMs: number; text: string };

/** Pas encore prêt : le travail est rejoué plus tard (2, 4, 8… minutes). */
class NotReady extends Error {}

async function fail(meetingId: string, error: string) {
  await db.meeting.update({ where: { id: meetingId }, data: { reportStatus: "FAILED", reportError: error } });
}

async function fromVexa(externalId: number): Promise<Line[]> {
  const segments = await getTranscript(externalId);
  return segments
    .filter((segment) => segment.text?.trim() && segment.completed !== false)
    .sort((a, b) => a.start - b.start)
    .map((segment) => ({
      speaker: segment.speaker?.trim() || null,
      startMs: Math.round(segment.start * 1000),
      endMs: Math.round(segment.end * 1000),
      text: segment.text.trim(),
    }));
}

async function fromMistral(meetingId: string, externalId: number): Promise<{ lines: Line[]; recordingId: number }> {
  const recording = await getAudioRecording(externalId);
  if (!recording) throw new NotReady("Enregistrement pas encore disponible sur le serveur de capture.");
  const meeting = await db.meeting.findUniqueOrThrow({
    where: { id: meetingId },
    select: { title: true, projectId: true, attendees: true, project: { select: { name: true, client: { select: { name: true } }, zones: { select: { name: true } } } } },
  });
  const team = await db.user.findMany({ where: { active: true }, select: { name: true } });
  const attendees = (meeting.attendees as { name?: string | null }[]).map((attendee) => attendee.name);

  const started = Date.now();
  let ok = true;
  let error: string | null = null;
  try {
    const result = await transcribeAudio({
      bytes: recording.bytes,
      filename: `reunion-${meetingId}.${recording.format || "webm"}`,
      contentType: recording.contentType,
      contextBias: biasTerms([
        meeting.project?.name,
        meeting.project?.client?.name,
        ...(meeting.project?.zones.map((zone) => zone.name) ?? []),
        ...team.map((member) => member.name),
        ...attendees,
      ]),
    });
    return {
      recordingId: recording.recordingId,
      lines: result.segments
        .filter((segment) => segment.text.trim())
        .map((segment) => ({
          speaker: segment.speaker,
          startMs: Math.round(segment.start * 1000),
          endMs: Math.round(segment.end * 1000),
          text: segment.text.trim(),
        })),
    };
  } catch (caught) {
    ok = false;
    error = caught instanceof Error ? caught.message.slice(0, 500) : String(caught);
    throw caught;
  } finally {
    await db.aiRun.create({
      data: {
        kind: "meeting_transcription",
        model: TRANSCRIPTION_MODEL,
        audioSeconds: recording.durationSeconds ? Math.round(recording.durationSeconds) : null,
        durationMs: Date.now() - started,
        ok,
        error,
        meetingId,
        projectId: meeting.projectId,
      },
    });
  }
}

export async function fetchTranscript(job: Job) {
  const { meetingId } = job.payload as { meetingId: string };
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    select: { reportStatus: true, captureExternalId: true, leftAt: true },
  });
  if (!meeting || meeting.reportStatus !== "TRANSCRIBING") return;
  if (!meeting.captureExternalId) return fail(meetingId, "Aucun enregistrement associé à cette réunion.");

  const source = getEnv().MEETING_TRANSCRIPTION;
  const lastAttempt = job.attempts >= MAX_ATTEMPTS;
  let lines: Line[];
  let recordingId: number | null = null;
  try {
    if (source === "mistral") ({ lines, recordingId } = await fromMistral(meetingId, Number(meeting.captureExternalId)));
    else lines = await fromVexa(Number(meeting.captureExternalId));
    if (lines.length === 0) throw new NotReady("Transcription vide pour l’instant.");
  } catch (error) {
    if (lastAttempt) {
      return fail(meetingId, error instanceof NotReady ? "Aucune transcription n’a été reçue pour cette réunion." : "La transcription a échoué.");
    }
    throw error;
  }

  await db.$transaction([
    db.meetingSegment.deleteMany({ where: { meetingId } }),
    db.meetingSegment.createMany({
      data: lines.map((line, index) => ({ meetingId, index, speaker: line.speaker, startMs: line.startMs, endMs: line.endMs, text: line.text })),
    }),
    db.meeting.update({
      where: { id: meetingId },
      data: {
        reportStatus: "EXTRACTING",
        transcriptSource: source,
        ...(recordingId !== null ? { recordingKey: String(recordingId) } : {}),
      },
    }),
  ]);
  await enqueueJob(MEETING_JOBS.report, { meetingId }, { dedupeKey: reportKey(meetingId, Date.now()) });
}
