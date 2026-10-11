import { ChevronLeft, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { AutoRefresh } from "@/components/meetings/auto-refresh";
import { CaptureControl } from "@/components/meetings/capture-control";
import { DeleteMeetingButton, RetryReportButton } from "@/components/meetings/meeting-actions";
import { ProjectPicker } from "@/components/meetings/project-picker";
import { ProposalReview } from "@/components/meetings/proposal-review";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentUser } from "@/lib/dal";
import { getEnv, integrationEnabled } from "@/lib/env";
import { capitalizeFirst } from "@/lib/fr";
import { CAPTURE_LABELS, formatDuration, formatOffset, PLATFORM_LABELS, REPORT_LABELS } from "@/lib/meetings/labels";
import { getMeetingReport } from "@/lib/meetings/queries";
import { isLive } from "@/lib/meetings/vexa-status";
import { plural } from "@/lib/plural";
import { formatParis } from "@/lib/time";

/** Un seul chargement par requête, partagé par generateMetadata et la page. */
const load = cache(async (id: string) => {
  const user = await getCurrentUser();
  const meeting = await getMeetingReport(id, { id: user.id, isAdmin: user.role === "ADMIN" });
  return { user, meeting };
});

export async function generateMetadata(props: PageProps<"/reunions/[id]">): Promise<Metadata> {
  const { meeting } = await load((await props.params).id);
  return { title: meeting ? meeting.title : "Réunion introuvable" };
}

const WORKING = ["TRANSCRIBING", "EXTRACTING"] as const;

export default async function MeetingPage(props: PageProps<"/reunions/[id]">) {
  const { meeting } = await load((await props.params).id);
  if (!meeting) notFound();

  const now = new Date();
  const ended = meeting.endsAt < now;
  const report = REPORT_LABELS[meeting.reportStatus];
  const capture = CAPTURE_LABELS[meeting.captureStatus];
  const working = isLive(meeting.captureStatus) || (WORKING as readonly string[]).includes(meeting.reportStatus);
  const hasReport = meeting.reportStatus === "READY" || meeting.reportStatus === "REVIEWED";
  const external = meeting.attendees.filter((attendee) => !attendee.self);
  const pendingCount = meeting.proposals.filter((proposal) => proposal.status === "PENDING").length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <AutoRefresh active={working} />
      <div className="mx-auto max-w-[var(--page-medium)] px-4 py-6 sm:px-8 sm:py-8">
        <Link href="/reunions" className="inline-flex items-center gap-1 text-ui text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Réunions
        </Link>

        <header className="mt-2">
          <h1 className="font-display text-h1 font-semibold tracking-tight">{meeting.title}</h1>
          <p className="tabular mt-1 text-body text-muted">
            {capitalizeFirst(formatParis(meeting.startsAt, "EEEE d MMMM yyyy 'à' HH'h'mm"))} · {formatDuration(meeting.startsAt, meeting.endsAt)}
            {meeting.platform ? ` · ${PLATFORM_LABELS[meeting.platform]}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <ProjectPicker
              meetingId={meeting.id}
              projectId={meeting.projectId}
              suggested={!!meeting.projectId && !meeting.projectConfirmedAt}
              locked={!!meeting.roundId}
            />
            {meeting.reportStatus !== "NONE" && <Badge tone={report.tone}>{report.label}</Badge>}
            {integrationEnabled("vexa") && !hasReport && (
              <CaptureControl
                meetingId={meeting.id}
                status={meeting.captureStatus}
                ended={ended}
                canManage={meeting.canManage}
                botName={getEnv().VEXA_BOT_NAME}
              />
            )}
          </div>
          {external.length > 0 && (
            <p className="mt-3 text-ui text-ink-2">
              <span className="text-muted">Participants : </span>
              {external.map((attendee) => attendee.name ?? attendee.email).join(", ")}
            </p>
          )}
          {meeting.captureApprovedBy && meeting.captureStatus !== "OFF" && (
            <p className="mt-1 text-meta text-muted">
              Enregistrement validé par {meeting.captureApprovedBy.name}
              {meeting.captureApprovedAt ? ` le ${formatParis(meeting.captureApprovedAt, "d MMM 'à' HH'h'mm")}` : ""}.
            </p>
          )}
        </header>

        {meeting.captureStatus === "FAILED" && meeting.captureError && (
          <p role="status" className="mt-6 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-ui text-ink">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger-text" aria-hidden="true" />
            {capture.label} : {meeting.captureError}
          </p>
        )}

        {meeting.reportStatus === "FAILED" && (
          <div role="status" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-ui text-ink">
            <TriangleAlert className="size-4 shrink-0 text-danger-text" aria-hidden="true" />
            <span className="min-w-0 flex-1">{meeting.reportError ?? "Le compte rendu automatique a échoué."}</span>
            <RetryReportButton meetingId={meeting.id} />
          </div>
        )}

        {(WORKING as readonly string[]).includes(meeting.reportStatus) && (
          <Card className="mt-6">
            <EmptyState compact tone="accent" title={report.label}>
              {meeting.reportStatus === "TRANSCRIBING"
                ? "La transcription arrive quelques minutes après la fin de la réunion."
                : "Lecture de la transcription et préparation des actions proposées."}{" "}
              Cette page se met à jour toute seule.
            </EmptyState>
          </Card>
        )}

        {hasReport && (
          <>
            <Card className="mt-6" aria-labelledby="resume">
              <CardHeader id="resume" title="Résumé" />
              <div className="space-y-5 px-5 pb-5">
                <p className="max-w-prose text-body text-ink-2">{meeting.summary ?? "Pas de résumé."}</p>
                {meeting.decisions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted">Décisions</h3>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-ui text-ink-2">
                      {meeting.decisions.map((decision) => (
                        <li key={decision}>{decision}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {meeting.openQuestions.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted">Questions ouvertes</h3>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-ui text-ink-2">
                      {meeting.openQuestions.map((question) => (
                        <li key={question}>{question}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>

            <section aria-labelledby="actions" className="mt-8">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="actions" className="text-title font-semibold tracking-title">
                  Actions proposées
                </h2>
                <p className="text-meta text-muted">
                  {pendingCount > 0 ? plural(pendingCount, "action à revoir", "actions à revoir") : "Tout est traité"} · l’IA propose, vous décidez
                </p>
              </div>
              <ProposalReview
                meetingId={meeting.id}
                hasProject={!!meeting.projectId}
                proposals={meeting.proposals}
                segments={meeting.segments}
                zones={meeting.project?.zones.map((zone) => zone.name) ?? []}
              />
            </section>
          </>
        )}

        {meeting.segments.length > 0 && (
          <Card className="mt-8" aria-labelledby="transcription">
            <CardHeader id="transcription" title="Transcription" count={meeting.segments.length} />
            <ol className="max-h-[60vh] space-y-0.5 overflow-y-auto border-t border-line px-3 py-3 scroll-thin">
              {meeting.segments.map((segment) => (
                <li key={segment.index} id={`s-${segment.index}`} className="scroll-mt-3 rounded-md px-2 py-1.5 text-ui target:bg-accent-soft">
                  <span className="tabular mr-2 text-meta text-muted">{formatOffset(segment.startMs)}</span>
                  {segment.speaker && <span className="mr-1.5 font-medium text-ink">{segment.speaker}</span>}
                  <span className="text-ink-2">{segment.text}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {meeting.reportStatus === "NONE" && ended && meeting.captureStatus !== "FAILED" && (
          <p className="mt-8 text-ui text-muted">Cette réunion n’a pas été enregistrée.</p>
        )}

        {meeting.canManage && ended && (
          <div className="mt-10 flex justify-end border-t border-line pt-4">
            <DeleteMeetingButton meetingId={meeting.id} />
          </div>
        )}
      </div>
    </div>
  );
}
