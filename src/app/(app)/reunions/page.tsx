import { CalendarClock, CalendarX2, ChevronRight, TriangleAlert, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AutoRefresh } from "@/components/meetings/auto-refresh";
import { CaptureControl } from "@/components/meetings/capture-control";
import { ProjectPicker } from "@/components/meetings/project-picker";
import { ProjectTile } from "@/components/primitives";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { getEnv, integrationEnabled } from "@/lib/env";
import { capitalizeFirst, NNBSP } from "@/lib/fr";
import { domainOf } from "@/lib/meetings/agency";
import { CAPTURE_LABELS, formatDuration, PLATFORM_LABELS, REPORT_LABELS } from "@/lib/meetings/labels";
import { getGoogleConnection, listMeetings, type MeetingListItem } from "@/lib/meetings/queries";
import { isLive } from "@/lib/meetings/vexa-status";
import { plural } from "@/lib/plural";
import { formatParis, startOfDayParis } from "@/lib/time";

export const metadata: Metadata = { title: "Réunions" };

const time = (date: Date) => formatParis(date, "HH'h'mm");

function dayLabel(date: Date, now: Date) {
  const day = startOfDayParis(date).getTime();
  const today = startOfDayParis(now).getTime();
  if (day === today) return "Aujourd’hui";
  if (day === startOfDayParis(new Date(now.getTime() + 24 * 3600_000)).getTime()) return "Demain";
  return capitalizeFirst(formatParis(date, "EEEE d MMMM"));
}

/** « Luna Cervi, Marie Dupont +2 » : les invités extérieurs d'abord. */
function attendeeSummary(meeting: MeetingListItem, agencyDomain: string) {
  const others = meeting.attendees.filter((attendee) => !attendee.self);
  const internal = (email: string) => Number(domainOf(email) === agencyDomain);
  const external = [...others].sort((a, b) => internal(a.email) - internal(b.email));
  const names = external.slice(0, 2).map((attendee) => attendee.name ?? attendee.email);
  return names.length ? `${names.join(", ")}${external.length > 2 ? ` +${external.length - 2}` : ""}` : "Sans autre participant";
}

function groupByDay(meetings: MeetingListItem[], now: Date) {
  const groups = new Map<string, MeetingListItem[]>();
  for (const meeting of meetings) {
    const label = dayLabel(meeting.startsAt, now);
    groups.set(label, [...(groups.get(label) ?? []), meeting]);
  }
  return [...groups.entries()];
}

function ProjectLabel({ projectId, projects }: { projectId: string | null; projects: Map<string, { name: string; key: string; color: string }> }) {
  const project = projectId ? projects.get(projectId) : null;
  if (!project) return <span className="text-meta text-muted">Sans projet</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-meta text-ink-2">
      <ProjectTile color={project.color} label={project.key} size={14} />
      <span className="truncate">{project.name}</span>
    </span>
  );
}

export default async function ReunionsPage(props: PageProps<"/reunions">) {
  const user = await getCurrentUser();
  const showInternal = (await props.searchParams).internes === "1";
  const now = new Date();
  const viewer = { id: user.id, isAdmin: user.role === "ADMIN" };
  const [google, meetings, projectRows] = await Promise.all([
    getGoogleConnection(user.id),
    listMeetings(viewer),
    db.project.findMany({ select: { id: true, name: true, key: true, color: true } }),
  ]);
  const projects = new Map(projectRows.map((project) => [project.id, project]));
  const captureAvailable = integrationEnabled("vexa");
  const { VEXA_BOT_NAME: botName, AGENCY_DOMAIN: agencyDomain } = getEnv();

  const upcoming = showInternal ? meetings.upcoming : meetings.upcoming.filter((meeting) => !meeting.internalOnly);
  const hiddenInternal = meetings.upcoming.length - upcoming.length;
  const working =
    meetings.upcoming.some((meeting) => isLive(meeting.captureStatus)) ||
    meetings.review.some((meeting) => meeting.reportStatus === "TRANSCRIBING" || meeting.reportStatus === "EXTRACTING");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <AutoRefresh active={working} />
      <div className="mx-auto max-w-[var(--page-medium)] px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="font-display text-h1 font-semibold tracking-tight">Réunions</h1>
        <p className="mt-1 max-w-prose text-body text-muted">
          Les réunions de vos agendas avec un lien Meet, Teams ou Zoom. Rien n’est enregistré sans votre accord, et aucune tâche n’est
          créée sans votre validation.
        </p>

        {!google.enabled ? (
          <Card className="mt-6">
            <EmptyState icon={<CalendarX2 />} tone="neutral" title="Agenda Google non configuré">
              Un administrateur doit renseigner GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et TOKEN_ENC_KEY sur le serveur (voir le README).
            </EmptyState>
          </Card>
        ) : !google.account ? (
          <Card className="mt-6">
            <EmptyState
              icon={<CalendarClock />}
              title="Connectez votre agenda Google"
              action={
                <a href="/api/auth/google" className={buttonClass({ variant: "primary" })}>
                  Connecter Google Agenda
                </a>
              }
            >
              Lecture seule : l’outil voit vos rendez-vous avec un lien de visioconférence, sans pouvoir les modifier ni lire vos e-mails.
            </EmptyState>
          </Card>
        ) : google.account.reconnectRequired ? (
          <p role="status" className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-ui text-ink">
            <TriangleAlert className="size-4 shrink-0 text-danger-text" aria-hidden="true" />
            <span className="min-w-0 flex-1">L’accès à votre agenda Google a été retiré : vos réunions ne sont plus mises à jour.</span>
            <a href="/api/auth/google" className={buttonClass({ size: "sm" })}>
              Reconnecter
            </a>
          </p>
        ) : null}

        {google.enabled && !captureAvailable && (
          <p className="mt-4 text-ui text-muted">
            Le serveur d’enregistrement n’est pas encore configuré : les réunions sont listées, mais le robot ne peut pas les rejoindre.
          </p>
        )}

        {meetings.review.length > 0 && (
          <Card className="mt-6" aria-labelledby="a-revoir">
            <CardHeader id="a-revoir" title="Comptes rendus" count={meetings.review.length} />
            <ul className="divide-y divide-line border-t border-line">
              {meetings.review.map((meeting) => {
                const report = REPORT_LABELS[meeting.reportStatus];
                return (
                  <li key={meeting.id}>
                    <Link href={`/reunions/${meeting.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 transition-colors hover:bg-surface-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium">{meeting.title}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="tabular text-meta text-muted">
                            {formatParis(meeting.startsAt, "d MMM")} · {time(meeting.startsAt)}
                          </span>
                          <ProjectLabel projectId={meeting.projectId} projects={projects} />
                        </span>
                      </span>
                      {meeting.reportStatus === "READY" ? (
                        <Badge tone="waiting">{plural(meeting.pendingProposals, "action à revoir", "actions à revoir")}</Badge>
                      ) : (
                        <Badge tone={report.tone}>{report.label}</Badge>
                      )}
                      <ChevronRight className="size-4 text-faint" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <section aria-labelledby="a-venir" className="mt-8">
          <SectionHeader
            id="a-venir"
            title="À venir"
            count={upcoming.length}
            action={
              hiddenInternal > 0 || showInternal ? (
                <Link href={showInternal ? "/reunions" : "/reunions?internes=1"} className="text-xs font-medium text-accent hover:underline">
                  {showInternal ? "Masquer les réunions internes" : `Afficher les réunions internes (${hiddenInternal})`}
                </Link>
              ) : undefined
            }
          />
          {upcoming.length === 0 ? (
            <Card>
              <EmptyState compact icon={<Video />} tone="neutral" title="Aucune réunion à venir">
                Les rendez-vous des 30 prochains jours avec un lien Meet, Teams ou Zoom apparaissent ici.
              </EmptyState>
            </Card>
          ) : (
            <div className="space-y-5">
              {groupByDay(upcoming, now).map(([day, items]) => (
                <div key={day}>
                  <h3 className="mb-1.5 text-xs font-semibold text-ink-2">{day}</h3>
                  <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
                    {items.map((meeting) => (
                      <li key={meeting.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                        <span className="w-28 shrink-0">
                          <span className="tabular block text-ui font-medium">
                            {time(meeting.startsAt)} – {time(meeting.endsAt)}
                          </span>
                          <span className="block text-meta text-muted">
                            {meeting.platform ? PLATFORM_LABELS[meeting.platform] : "Visio"} · {formatDuration(meeting.startsAt, meeting.endsAt)}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 basis-56">
                          <Link href={`/reunions/${meeting.id}`} className="block truncate text-body font-medium hover:underline">
                            {meeting.title}
                          </Link>
                          <span className="block truncate text-meta text-muted">
                            {attendeeSummary(meeting, agencyDomain)}
                            {meeting.ownerName && meeting.ownerName !== user.name ? ` · agenda de ${meeting.ownerName}` : ""}
                          </span>
                          {meeting.captureStatus === "FAILED" && meeting.captureError && (
                            <span className="mt-0.5 block text-meta text-danger-text">{meeting.captureError}</span>
                          )}
                        </span>
                        {meeting.internalOnly && <Chip>Interne</Chip>}
                        <ProjectPicker
                          meetingId={meeting.id}
                          projectId={meeting.projectId}
                          suggested={!!meeting.projectId && !meeting.projectConfirmedAt}
                          locked={!!meeting.roundId}
                        />
                        {captureAvailable && (
                          <CaptureControl
                            meetingId={meeting.id}
                            status={meeting.captureStatus}
                            ended={meeting.endsAt < now}
                            canManage={meeting.canManage}
                            botName={botName}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        {meetings.past.length > 0 && (
          <section aria-labelledby="passees" className="mt-8">
            <SectionHeader id="passees" title="Passées" count={meetings.past.length} />
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
              {meetings.past.map((meeting) => {
                const status = meeting.reportStatus === "REVIEWED" ? REPORT_LABELS.REVIEWED : CAPTURE_LABELS[meeting.captureStatus];
                return (
                  <li key={meeting.id}>
                    <Link href={`/reunions/${meeting.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 transition-colors hover:bg-surface-2">
                      <span className="tabular w-28 shrink-0 text-meta text-muted">
                        {formatParis(meeting.startsAt, "d MMM")} · {time(meeting.startsAt)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ui">{meeting.title}</span>
                      <ProjectLabel projectId={meeting.projectId} projects={projects} />
                      <Badge tone={status.tone} variant="outline">
                        {status.label}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-meta text-muted">
              Transcriptions gardées un an, enregistrements audio 30{NNBSP}jours.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
