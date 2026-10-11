import { ArrowDownLeft, ArrowUpRight, ChevronRight, MailPlus, MailX, UserRoundPlus, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RefreshMailboxButton } from "@/components/emails/email-buttons";
import { SenderSuggestion } from "@/components/emails/sender-suggestion";
import { LocalTime } from "@/components/local-time";
import { AutoRefresh } from "@/components/meetings/auto-refresh";
import { ProjectTile } from "@/components/primitives";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { getCurrentUser } from "@/lib/dal";
import { integrationEnabled } from "@/lib/env";
import { listEmails, routingOptions, type EmailRow } from "@/lib/emails/queries";
import { plural } from "@/lib/plural";
import { EMAIL_ANALYSIS_LABELS } from "@/lib/meetings/labels";
import { getGoogleConnection } from "@/lib/meetings/queries";
import { formatParis } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "E-mails" };

type Projects = Map<string, { name: string; key: string; color: string }>;

function counterpart(email: EmailRow) {
  if (email.direction === "IN") return email.fromName ?? email.fromEmail;
  const first = email.toEmails[0] ?? "";
  return `À ${first}${email.toEmails.length > 1 ? ` +${email.toEmails.length - 1}` : ""}`;
}

function EmailLine({ email, projects }: { email: EmailRow; projects: Projects }) {
  const project = email.projectId ? projects.get(email.projectId) : null;
  const analysis = EMAIL_ANALYSIS_LABELS[email.analysis];
  const Direction = email.direction === "IN" ? ArrowDownLeft : ArrowUpRight;
  return (
    <li>
      <Link href={`/courriels/${email.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-surface-2">
        <span className="tabular w-20 shrink-0 text-meta text-muted">{formatParis(email.sentAt, "d MMM HH'h'mm")}</span>
        <span className="min-w-0 flex-1 basis-64">
          <span className="flex min-w-0 items-center gap-1.5">
            <Direction className={cn("size-3.5 shrink-0", email.direction === "IN" ? "text-accent" : "text-muted")} aria-label={email.direction === "IN" ? "Reçu" : "Envoyé"} />
            <span className="truncate text-ui font-medium">{counterpart(email)}</span>
          </span>
          <span className="block truncate text-ui text-ink-2">
            {email.subject}
            {email.snippet ? <span className="text-muted"> — {email.snippet}</span> : null}
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5 text-meta text-ink-2">
          {project ? (
            <>
              <ProjectTile color={project.color} label={project.key} size={14} />
              <span className="truncate">{project.name}</span>
            </>
          ) : (
            <span className="truncate">{email.client?.name ?? "Sans client"}</span>
          )}
        </span>
        {email.meetingLink && <Chip icon={<Video className="size-3" aria-hidden="true" />}>Visio</Chip>}
        {email.analysis === "READY" ? (
          <Badge tone="waiting">{plural(email._count.proposals, "action à revoir", "actions à revoir")}</Badge>
        ) : email.analysis === "PENDING" || email.analysis === "FAILED" ? (
          <Badge tone={analysis.tone}>{analysis.label}</Badge>
        ) : null}
        <ChevronRight className="size-4 text-faint" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default async function EmailsPage(props: PageProps<"/courriels">) {
  const user = await getCurrentUser();
  const clientFilter = (await props.searchParams).client;
  const clientId = typeof clientFilter === "string" ? clientFilter : null;
  const [google, emails, options] = await Promise.all([getGoogleConnection(user.id), listEmails({ clientId }), routingOptions()]);
  const projects: Projects = new Map(options.projects.map((project) => [project.id, project]));
  const account = google.enabled ? google.account : null;
  const gmail = !!account?.gmailConnectedAt;
  const filteredClient = clientId ? options.clients.find((client) => client.id === clientId) : null;
  const working = emails.review.some((email) => email.analysis === "PENDING");
  const recentClients = [...new Map(emails.recent.flatMap((email) => (email.clientId && email.client ? [[email.clientId, email.client.name] as const] : []))).entries()].slice(0, 8);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <AutoRefresh active={working} />
      <div className="mx-auto max-w-[var(--page-medium)] px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="font-display text-h1 font-semibold tracking-tight">E-mails</h1>
        <p className="mt-1 max-w-prose text-body text-muted">
          Vos échanges avec les clients, lus dans Gmail en lecture seule et rattachés au bon client et au bon projet. L’IA propose des actions
          et des réunions ; rien n’est créé sans votre validation.
        </p>

        {!google.enabled ? (
          <Card className="mt-6">
            <EmptyState icon={<MailX />} tone="neutral" title="Google non configuré">
              Un administrateur doit renseigner GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et TOKEN_ENC_KEY sur le serveur.
            </EmptyState>
          </Card>
        ) : !account ? (
          <Card className="mt-6">
            <EmptyState
              icon={<MailPlus />}
              title="Connectez d’abord votre compte Google"
              action={
                <Link href="/settings#google" className={buttonClass({ variant: "primary" })}>
                  Aller dans Paramètres
                </Link>
              }
            >
              L’agenda d’abord, puis Gmail : deux autorisations séparées, en lecture seule.
            </EmptyState>
          </Card>
        ) : !gmail ? (
          <Card className="mt-6">
            <EmptyState
              icon={<MailPlus />}
              title="Connectez Gmail"
              action={
                <a href="/api/auth/google?gmail=1" className={buttonClass({ variant: "primary" })}>
                  Connecter Gmail (lecture seule)
                </a>
              }
            >
              L’outil lit vos e-mails pour les rattacher aux clients ; il ne peut ni en envoyer ni en supprimer. Seuls les échanges avec des
              clients sont gardés, et leur texte est effacé après 30 jours. Les lettres d’information sont ignorées.
            </EmptyState>
          </Card>
        ) : (
          <div className="mt-4">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui text-muted">
              <span>
                Gmail {account.email} ·{" "}
                {account.gmailSyncedAt ? (
                  <>
                    lu <LocalTime date={account.gmailSyncedAt} relative />
                  </>
                ) : (
                  "première lecture en cours"
                )}
                {account.gmailPendingIds.length > 0 ? ` · ${plural(account.gmailPendingIds.length, "e-mail", "e-mails")} en attente de lecture` : ""}
              </span>
              <RefreshMailboxButton />
            </p>
            {account.gmailError && <p className="mt-1 text-meta text-danger-text">Dernière lecture en échec : {account.gmailError}</p>}
          </div>
        )}

        {gmail && !integrationEnabled("mistral") && (
          <p className="mt-4 text-ui text-muted">
            La lecture par l’IA n’est pas configurée (MISTRAL_API_KEY) : les e-mails sont rattachés aux clients, sans actions proposées.
          </p>
        )}

        {emails.review.length > 0 && (
          <Card className="mt-6" aria-labelledby="a-revoir">
            <CardHeader id="a-revoir" title="À revoir" count={emails.review.length} />
            <ul className="divide-y divide-line border-t border-line">
              {emails.review.map((email) => (
                <EmailLine key={email.id} email={email} projects={projects} />
              ))}
            </ul>
          </Card>
        )}

        {emails.senders.length > 0 && (
          <Card className="mt-6" aria-labelledby="interlocuteurs">
            <CardHeader id="interlocuteurs" title="Nouveaux interlocuteurs" count={emails.senders.length} icon={<UserRoundPlus className="size-4 text-muted" aria-hidden="true" />} />
            <p className="-mt-1 px-5 pb-3 text-ui text-muted">Des adresses inconnues avec qui vous avez échangé. Ajoutez-les à un client pour rattacher leurs e-mails.</p>
            <ul className="divide-y divide-line border-t border-line">
              {emails.senders.map((sender) => (
                <SenderSuggestion key={sender.email} sender={sender} clients={options.clients} />
              ))}
            </ul>
          </Card>
        )}

        <section aria-labelledby="echanges" className="mt-8">
          <SectionHeader
            id="echanges"
            title={filteredClient ? `Échanges avec ${filteredClient.name}` : "Échanges récents"}
            count={emails.recent.length}
            action={
              filteredClient ? (
                <Link href="/courriels" className="text-xs font-medium text-accent hover:underline">
                  Tous les clients
                </Link>
              ) : undefined
            }
          />
          {!filteredClient && recentClients.length > 1 && (
            <nav aria-label="Filtrer par client" className="mb-3 flex flex-wrap gap-1.5">
              {recentClients.map(([id, name]) => (
                <Link key={id} href={`/courriels?client=${id}`} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink pointer-coarse:min-h-11 pointer-coarse:py-3">
                  {name}
                </Link>
              ))}
            </nav>
          )}
          {emails.recent.length === 0 ? (
            <Card>
              <EmptyState compact icon={<MailPlus />} tone="neutral" title="Aucun échange rattaché pour l’instant">
                Les e-mails échangés avec les contacts de vos clients apparaissent ici après la lecture de Gmail.
              </EmptyState>
            </Card>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
              {emails.recent.map((email) => (
                <EmailLine key={email.id} email={email} projects={projects} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
