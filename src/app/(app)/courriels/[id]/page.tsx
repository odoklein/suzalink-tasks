import { CalendarClock, ChevronLeft, ExternalLink, TriangleAlert, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { acceptEmailProposalsAction, ignoreEmailProposalAction, linkEmailProposalAction } from "@/app/actions/emails";
import { RetryAnalysisButton } from "@/components/emails/email-buttons";
import { EmailRoutePicker } from "@/components/emails/email-route-picker";
import { AutoRefresh } from "@/components/meetings/auto-refresh";
import { ProposalReview } from "@/components/meetings/proposal-review";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { verifySession } from "@/lib/dal";
import { getEmailDetail, routingOptions } from "@/lib/emails/queries";
import { capitalizeFirst } from "@/lib/fr";
import { gmailThreadUrl } from "@/lib/google/gmail";
import { EMAIL_ANALYSIS_LABELS } from "@/lib/meetings/labels";
import { plural } from "@/lib/plural";
import { formatParis } from "@/lib/time";

const load = cache(async (id: string) => {
  await verifySession();
  return getEmailDetail(id);
});

export async function generateMetadata(props: PageProps<"/courriels/[id]">): Promise<Metadata> {
  const email = await load((await props.params).id);
  return { title: email ? email.subject : "E-mail introuvable" };
}

export default async function EmailPage(props: PageProps<"/courriels/[id]">) {
  const email = await load((await props.params).id);
  if (!email) notFound();
  const options = await routingOptions();
  const analysis = EMAIL_ANALYSIS_LABELS[email.analysis];
  const pendingCount = email.proposals.filter((proposal) => proposal.status === "PENDING").length;
  const from = email.fromName ? `${email.fromName} <${email.fromEmail}>` : email.fromEmail;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <AutoRefresh active={email.analysis === "PENDING"} />
      <div className="mx-auto max-w-[var(--page-medium)] px-4 py-6 sm:px-8 sm:py-8">
        <Link href="/courriels" className="inline-flex items-center gap-1 text-ui text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> E-mails
        </Link>

        <header className="mt-2">
          <h1 className="font-display text-h1 font-semibold tracking-tight">{email.subject}</h1>
          <p className="mt-1 text-body text-muted">
            {email.direction === "IN" ? `Reçu de ${from}` : `Envoyé à ${email.toEmails.join(", ")}`} ·{" "}
            <span className="tabular">{capitalizeFirst(formatParis(email.sentAt, "EEEE d MMMM yyyy 'à' HH'h'mm"))}</span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <EmailRoutePicker emailId={email.id} clientId={email.clientId} projectId={email.projectId} options={options} locked={!!email.roundId} />
            {email.analysis !== "NONE" && <Badge tone={analysis.tone}>{analysis.label}</Badge>}
            <a
              href={gmailThreadUrl(email.gmailThreadId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-ui font-medium text-accent hover:underline"
            >
              Ouvrir dans Gmail <ExternalLink className="size-3.5" aria-hidden="true" />
              <span className="sr-only">(nouvel onglet)</span>
            </a>
          </div>
          {email.oauthAccount && <p className="mt-1 text-meta text-muted">Lu dans la boîte de {email.oauthAccount.user.name}.</p>}
        </header>

        {email.analysis === "FAILED" && (
          <div role="status" className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-ui text-ink">
            <TriangleAlert className="size-4 shrink-0 text-danger-text" aria-hidden="true" />
            <span className="min-w-0 flex-1">{email.analysisError ?? "La lecture automatique a échoué."}</span>
            <RetryAnalysisButton emailId={email.id} />
          </div>
        )}

        {(email.meeting || email.meetingLink) && (
          <Card className="mt-6 px-5 py-4">
            {email.meeting ? (
              <p className="flex flex-wrap items-center gap-2 text-ui">
                <CalendarClock className="size-4 text-accent" aria-hidden="true" />
                <span className="text-ink-2">Réunion {email.meeting.source === "email" && !email.meeting.confirmedAt ? "proposée" : "prévue"} :</span>
                <Link href={`/reunions/${email.meeting.id}`} className="font-medium text-accent hover:underline">
                  {email.meeting.title}, {formatParis(email.meeting.startsAt, "EEEE d MMMM 'à' HH'h'mm")}
                </Link>
              </p>
            ) : (
              <p className="flex flex-wrap items-center gap-2 text-ui text-ink-2">
                <Video className="size-4 text-muted" aria-hidden="true" />
                Lien de visio dans l’e-mail, sans heure claire :
                <a href={email.meetingLink!} target="_blank" rel="noreferrer" className="break-all font-medium text-accent hover:underline">
                  {email.meetingLink}
                </a>
              </p>
            )}
          </Card>
        )}

        {email.summary && (
          <Card className="mt-6 px-5 py-4">
            <h2 className="text-xs font-semibold text-muted">En bref</h2>
            <p className="mt-1 max-w-prose text-body text-ink-2">{email.summary}</p>
          </Card>
        )}

        {email.proposals.length > 0 && (
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
              actions={{
                accept: acceptEmailProposalsAction.bind(null, email.id),
                link: linkEmailProposalAction.bind(null, email.id),
                ignore: ignoreEmailProposalAction.bind(null, email.id),
              }}
              hasProject={!!email.projectId}
              proposals={email.proposals}
              zones={email.project?.zones.map((zone) => zone.name) ?? []}
              noProjectHint="Rattachez d’abord l’e-mail à un projet pour créer les tâches."
            />
          </section>
        )}

        <Card className="mt-8" aria-labelledby="message">
          <CardHeader id="message" title="Message" />
          <div className="border-t border-line px-5 py-4">
            {email.bodyText ? (
              <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words text-ui text-ink-2 scroll-thin">{email.bodyText}</p>
            ) : (
              <p className="text-ui text-muted">
                {email.bodyPurgedAt ? "Texte effacé après 30 jours (les citations des actions restent)." : "Pas de texte lisible dans ce message."}
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
