import type { Metadata } from "next";

import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";
import { failedJobs } from "@/lib/jobs/queue";
import { isStale, MAX_ATTEMPTS } from "@/lib/jobs/schedule";
import { formatParis } from "@/lib/time";
import { timeAgo } from "@/lib/utils";

import { SettingsCard, SettingsSubpage } from "../settings-page";
import { RetryJobButton } from "./retry-job-button";

export const metadata: Metadata = { title: "Intégrations" };

const PROVIDERS: Record<string, string> = {
  cron: "Cron (chaque minute)",
  netlify: "Netlify",
  vercel: "Vercel",
  github: "GitHub",
  postmark: "E-mails entrants (Postmark)",
  telegram: "Telegram",
  slack: "Slack",
  sheets: "Google Sheets",
  resend: "E-mails sortants (Resend)",
};

const when = (date: Date | null) => (date ? `${formatParis(date, "d MMM HH'h'mm")} (${timeAgo(date)})` : "jamais");

export default async function IntegrationsPage() {
  await requireAdminPage();
  const [statuses, jobs] = await Promise.all([db.integrationStatus.findMany({ orderBy: { provider: "asc" } }), failedJobs()]);
  const cron = statuses.find((status) => status.provider === "cron");
  const cronLate = isStale(cron?.lastReceivedAt, 5);

  return (
    <SettingsSubpage title="Intégrations" description="Ce que l’outil reçoit de l’extérieur, et les travaux de fond qui ont échoué.">
      {cronLate && (
        <p role="status" className="mt-6 rounded-lg border border-st-waiting/40 bg-surface-2 px-4 py-3 text-[13px] text-ink-2">
          Le cron n’a pas tourné depuis plus de 5 minutes : relances, e-mails et synchronisations sont en pause. Vérifiez la tâche
          pg_cron dans Supabase (voir le README).
        </p>
      )}

      <SettingsCard title="Derniers signaux reçus">
        {statuses.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">Aucun signal reçu pour l’instant.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {statuses.map((status) => (
              <li key={status.provider} className="px-3 py-2.5 text-[13px]">
                <p className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{PROVIDERS[status.provider] ?? status.provider}</span>
                  <span className="text-muted" suppressHydrationWarning>
                    {when(status.lastReceivedAt)}
                  </span>
                </p>
                {status.lastError && status.lastErrorAt && (!status.lastOkAt || status.lastErrorAt > status.lastOkAt) && (
                  <p className="mt-1 text-[12px] text-danger">Dernière erreur : {status.lastError}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>

      <SettingsCard
        title="Travaux en échec"
        description={`Chaque travail est retenté avec un délai croissant, ${MAX_ATTEMPTS} fois au plus.`}
      >
        {jobs.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">Aucun travail en échec.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-start gap-3 px-3 py-2.5 text-[13px]">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {job.kind}
                    <span className="ml-2 font-normal text-muted">
                      {job.attempts >= MAX_ATTEMPTS ? "abandonné" : `tentative ${job.attempts}/${MAX_ATTEMPTS}`}
                    </span>
                  </p>
                  <p className="mt-0.5 break-words text-[12px] text-danger">{job.lastError}</p>
                </div>
                <RetryJobButton jobId={job.id} />
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </SettingsSubpage>
  );
}
