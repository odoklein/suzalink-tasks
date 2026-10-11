import "server-only";

import type { Job } from "@prisma/client";

import {
  buildReportPrompt,
  checkReport,
  MAX_TRANSCRIPT_CHARS,
  REPORT_PROMPT_VERSION,
  reportJsonSchema,
  reportSchema,
  SYSTEM_PROMPT,
} from "@/lib/ai/meeting-report";
import { chatJson, MistralError } from "@/lib/ai/mistral";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { MAX_ATTEMPTS } from "@/lib/jobs/schedule";
import { taskRef } from "@/lib/services/core";
import { emitEvent } from "@/lib/services/outbox";

/**
 * Travail `meeting_report` : Mistral lit la transcription et propose un
 * compte rendu et des actions ; le code vérifie chaque citation avant
 * d'écrire les propositions. Rien n'est créé dans le projet à ce stade.
 */
export async function buildReport(job: Job) {
  const { meetingId } = job.payload as { meetingId: string };
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    include: {
      segments: { orderBy: { index: "asc" } },
      project: {
        select: {
          name: true,
          key: true,
          zones: { orderBy: { position: "asc" }, select: { name: true } },
          tasks: {
            where: { status: { not: "DONE" } },
            orderBy: { number: "desc" },
            take: 200,
            select: { id: true, number: true, zone: true, title: true },
          },
        },
      },
    },
  });
  if (!meeting || meeting.reportStatus !== "EXTRACTING") return;
  const fail = async (error: string) => {
    await db.meeting.update({ where: { id: meetingId }, data: { reportStatus: "FAILED", reportError: error } });
  };
  if (meeting.segments.length === 0) return fail("Transcription vide : pas de compte rendu possible.");

  const lines = meeting.segments.map((segment) => ({ index: segment.index, speaker: segment.speaker, startMs: segment.startMs, text: segment.text }));
  const openTasks = (meeting.project?.tasks ?? []).map((task) => ({
    id: task.id,
    ref: taskRef(meeting.project!.key, task.number),
    zone: task.zone,
    title: task.title,
  }));
  const zones = meeting.project?.zones.map((zone) => zone.name) ?? [];
  const attendees = (meeting.attendees as { email: string; name: string | null }[]).map((attendee) => attendee.name ?? attendee.email);
  const user = buildReportPrompt({
    title: meeting.title,
    startsAt: meeting.startsAt,
    projectName: meeting.project?.name ?? null,
    zones,
    openTasks,
    attendees,
    lines,
  });
  if (user.length > MAX_TRANSCRIPT_CHARS) return fail("Réunion trop longue pour un compte rendu automatique.");

  const team = await db.user.findMany({ where: { active: true }, select: { id: true, name: true } });
  const model = getEnv().MISTRAL_MODEL;
  const started = Date.now();
  let result: Awaited<ReturnType<typeof chatJson<typeof reportSchema>>>;
  try {
    result = await chatJson({ model, system: SYSTEM_PROMPT, user, name: "compte_rendu_reunion", schema: reportSchema, jsonSchema: reportJsonSchema });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.aiRun.create({
      data: { kind: "meeting_report", model, durationMs: Date.now() - started, ok: false, error: message.slice(0, 500), meetingId, projectId: meeting.projectId },
    });
    // Erreur passagère (limite de débit, panne) : rejouée plus tard, sauf à la dernière tentative.
    const transient = error instanceof MistralError && (error.status === 429 || error.status >= 500);
    if (transient && job.attempts < MAX_ATTEMPTS) throw error;
    await fail(transient ? "Mistral est indisponible : relancez le compte rendu plus tard." : "Le compte rendu automatique a échoué.");
    return;
  }

  const checked = checkReport(result.data, { lines, openTasks, zones, team, startsAt: meeting.startsAt });
  await db.$transaction(async (tx) => {
    await tx.meetingProposal.deleteMany({ where: { meetingId, status: "PENDING" } });
    await tx.meetingProposal.createMany({ data: checked.proposals.map((proposal) => ({ ...proposal, meetingId })) });
    await tx.meeting.update({
      where: { id: meetingId },
      data: {
        reportStatus: checked.proposals.length ? "READY" : "REVIEWED",
        reportError: null,
        reportReadyAt: new Date(),
        summary: checked.summary || null,
        decisions: checked.decisions,
        openQuestions: checked.openQuestions,
      },
    });
    await tx.aiRun.create({
      data: {
        kind: `meeting_report:${REPORT_PROMPT_VERSION}`,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs: Date.now() - started,
        meetingId,
        projectId: meeting.projectId,
      },
    });
    await emitEvent(tx, { userId: null, via: "SYSTEM" }, {
      type: "meeting.report_ready",
      projectId: meeting.projectId,
      payload: { meetingId, title: meeting.title, proposals: checked.proposals.length },
    });
  });
}
