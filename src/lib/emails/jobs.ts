import "server-only";

import { db } from "@/lib/db";
import { integrationEnabled } from "@/lib/env";
import { analyzeEmail } from "@/lib/emails/analyze";
import { EMAIL_JOBS, syncMailboxes } from "@/lib/emails/sync";
import { registerDailyStep, registerJobHandler, registerRecurringJobs } from "@/lib/jobs/handlers";
import { calendarSyncKey } from "@/lib/meetings/job-kinds";

/** Texte des e-mails gardé 30 jours (citations des actions conservées) ; inconnus oubliés après un an. */
export const EMAIL_BODY_RETENTION_DAYS = 30;
const SENDER_RETENTION_DAYS = 365;

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 3600_000);

export async function purgeEmailData() {
  await db.emailMessage.updateMany({
    where: { bodyText: { not: null }, sentAt: { lt: daysAgo(EMAIL_BODY_RETENTION_DAYS) } },
    data: { bodyText: null, bodyPurgedAt: new Date() },
  });
  await db.emailSender.deleteMany({ where: { lastSeenAt: { lt: daysAgo(SENDER_RETENTION_DAYS) } } });
}

/** Branche les e-mails clients sur la file de travaux (appelé une fois par src/lib/jobs/setup.ts). */
export function registerEmailJobs() {
  registerJobHandler(EMAIL_JOBS.sync, (job) => syncMailboxes((job.payload as { accountId?: string }).accountId));
  registerJobHandler(EMAIL_JOBS.analyze, analyzeEmail);
  registerRecurringJobs("emails", (now) =>
    integrationEnabled("google") ? [{ kind: EMAIL_JOBS.sync, dedupeKey: calendarSyncKey(now).replace("calsync", "gmailsync"), runAt: now }] : [],
  );
  registerDailyStep({ name: "email-retention", run: purgeEmailData });
}
