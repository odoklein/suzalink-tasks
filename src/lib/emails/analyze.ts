import "server-only";

import type { Job } from "@prisma/client";

import { buildEmailPrompt, checkEmailReport, EMAIL_PROMPT_VERSION, EMAIL_SYSTEM_PROMPT, emailReportJsonSchema, emailReportSchema } from "@/lib/ai/email-report";
import { chatJson, MistralError } from "@/lib/ai/mistral";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { MAX_ATTEMPTS } from "@/lib/jobs/schedule";
import { taskRef } from "@/lib/services/core";

/**
 * Travail `email_analyze` : Mistral lit un e-mail client et propose des
 * actions (citations vérifiées) et, s'il y a un lien de visio et une heure
 * claire, une réunion à confirmer. Rien n'est créé dans le projet ici.
 */
export async function analyzeEmail(job: Job) {
  const { emailId } = job.payload as { emailId: string };
  const email = await db.emailMessage.findUnique({
    where: { id: emailId },
    include: {
      project: {
        select: {
          name: true,
          key: true,
          zones: { orderBy: { position: "asc" }, select: { name: true } },
          tasks: { where: { status: { not: "DONE" } }, orderBy: { number: "desc" }, take: 150, select: { id: true, number: true, zone: true, title: true } },
        },
      },
    },
  });
  if (!email || email.analysis !== "PENDING") return;
  const fail = async (error: string) => {
    await db.emailMessage.update({ where: { id: emailId }, data: { analysis: "FAILED", analysisError: error } });
  };
  if (!email.bodyText) return fail("E-mail sans texte à lire.");

  const openTasks = (email.project?.tasks ?? []).map((task) => ({ id: task.id, ref: taskRef(email.project!.key, task.number), zone: task.zone, title: task.title }));
  const zones = email.project?.zones.map((zone) => zone.name) ?? [];
  const model = getEnv().MISTRAL_EMAIL_MODEL;
  const started = Date.now();
  let result: Awaited<ReturnType<typeof chatJson<typeof emailReportSchema>>>;
  try {
    result = await chatJson({
      model,
      system: EMAIL_SYSTEM_PROMPT,
      user: buildEmailPrompt({
        subject: email.subject,
        from: email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail,
        sentAt: email.sentAt,
        projectName: email.project?.name ?? null,
        zones,
        openTasks,
        body: email.bodyText,
      }),
      name: "lecture_email_client",
      schema: emailReportSchema,
      jsonSchema: emailReportJsonSchema,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.aiRun.create({ data: { kind: "email_report", model, durationMs: Date.now() - started, ok: false, error: message.slice(0, 500), projectId: email.projectId } });
    const transient = error instanceof MistralError && (error.status === 429 || error.status >= 500);
    if (transient && job.attempts < MAX_ATTEMPTS) throw error;
    return fail(transient ? "Mistral est indisponible : relancez plus tard." : "La lecture automatique a échoué.");
  }

  const team = await db.user.findMany({ where: { active: true }, select: { id: true, name: true } });
  const checked = checkEmailReport(result.data, { body: email.bodyText, openTasks, zones, team, sentAt: email.sentAt, now: new Date() });

  await db.$transaction(async (tx) => {
    await tx.emailProposal.deleteMany({ where: { emailId, status: "PENDING" } });
    await tx.emailProposal.createMany({ data: checked.proposals.map((proposal) => ({ ...proposal, emailId })) });
    await tx.emailMessage.update({
      where: { id: emailId },
      data: { analysis: checked.proposals.length ? "READY" : "REVIEWED", analysisError: null, summary: checked.summary || null },
    });
    await tx.aiRun.create({
      data: {
        kind: `email_report:${EMAIL_PROMPT_VERSION}`,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs: Date.now() - started,
        projectId: email.projectId,
      },
    });

    // Réunion proposée par e-mail : à confirmer dans Réunions, jamais enregistrée d'office.
    const meeting = checked.meeting;
    if (meeting) {
      const window = 2 * 3600_000;
      const known = await tx.meeting.findFirst({
        where: {
          nativeMeetingId: meeting.link.nativeMeetingId,
          startsAt: { gte: new Date(meeting.startsAt.getTime() - window), lte: new Date(meeting.startsAt.getTime() + window) },
        },
        select: { id: true },
      });
      if (!known) {
        await tx.meeting.create({
          data: {
            title: email.subject.slice(0, 300),
            startsAt: meeting.startsAt,
            endsAt: meeting.endsAt,
            platform: meeting.link.platform,
            joinUrl: meeting.link.url,
            nativeMeetingId: meeting.link.nativeMeetingId,
            passcode: meeting.link.passcode,
            attendees: [{ email: email.fromEmail, name: email.fromName, organizer: true, self: false, responseStatus: null }, ...email.toEmails.map((address) => ({ email: address, name: null, organizer: false, self: false, responseStatus: null }))],
            source: "email",
            emailMessageId: emailId,
            oauthAccountId: email.oauthAccountId,
            projectId: email.projectId,
            projectSuggestedBy: email.projectId ? "email" : null,
          },
        });
      }
    }
  });
}
