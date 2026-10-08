"use client";

import type { ClientKind, ProjectStatus } from "@prisma/client";
import { differenceInCalendarDays } from "date-fns";
import { ExternalLink, FileSpreadsheet, MessageSquareText, Rocket } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateProjectStatus } from "@/app/actions/projects";
import { Board } from "@/components/board";
import { GhostButton, PrimaryButton } from "@/components/dialog";
import { ImportDialog } from "@/components/import-dialog";
import { Avatar, ProjectTile } from "@/components/primitives";
import { ProjectNote } from "@/components/project-note";
import { DeliveryDialog, RecapDialog } from "@/components/project-dialogs";
import { SelectMenu } from "@/components/select-menu";
import { TaskList } from "@/components/task-list";
import { PROJECT_STATUSES, PROJECT_STATUS_BY_VALUE } from "@/lib/constants";
import { looksLikeTable } from "@/lib/feedback-import";
import type { TaskCard } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export type ProjectTab = "tableau" | "liste" | "mises-en-ligne" | "activite";

type ProjectData = {
  id: string;
  name: string;
  key: string;
  color: string;
  status: ProjectStatus;
  endClient: string | null;
  siteUrl: string | null;
  description: string | null;
  statusNote: string | null;
  statusNoteAt: Date | null;
  client: { name: string; kind: ClientKind; contacts: string | null } | null;
  lead: { name: string; color: string } | null;
  tasks: TaskCard[];
  deliveries: {
    id: string;
    title: string;
    notes: string | null;
    url: string | null;
    deployedAt: Date;
    author: { name: string; color: string } | null;
  }[];
  activities: {
    id: string;
    message: string;
    createdAt: Date;
    actor: { name: string; color: string } | null;
  }[];
};

const TAB_LABELS: Record<ProjectTab, string> = {
  tableau: "Tableau",
  liste: "Liste",
  "mises-en-ligne": "Mises en ligne",
  activite: "Activité",
};

export function ProjectView({
  project,
  initialTab,
  sourceFilter = null,
}: {
  project: ProjectData;
  initialTab: ProjectTab;
  /** Source d'import à isoler dans la liste (atterrissage après un import). */
  sourceFilter?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<ProjectTab>(initialTab);
  const [dialog, setDialog] = useState<"import" | "recap" | "delivery" | null>(null);
  const [importText, setImportText] = useState("");
  const [, startTransition] = useTransition();

  // L'URL gouverne la vue : un lien (ou l'atterrissage après un import) change d'onglet.
  const [seenInitialTab, setSeenInitialTab] = useState(initialTab);
  if (seenInitialTab !== initialTab) {
    setSeenInitialTab(initialTab);
    setTab(initialTab);
  }

  // Coller un tableau n'importe où sur la page ouvre l'import, déjà rempli.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (dialog) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (!looksLikeTable(text)) return;
      event.preventDefault();
      setImportText(text);
      setDialog("import");
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [dialog]);

  const open = project.tasks.filter((task) => task.status !== "DONE").length;
  const waiting = project.tasks.filter((task) => task.status === "WAITING_CLIENT").length;
  const billable = project.tasks.filter((task) => task.billable).length;
  const status = PROJECT_STATUS_BY_VALUE[project.status];
  const oldestWaiting = project.tasks
    .filter((task) => task.status === "WAITING_CLIENT")
    .reduce<Date | null>((oldest, task) => {
      const since = new Date(task.statusChangedAt);
      return !oldest || since < oldest ? since : oldest;
    }, null);
  const oldestWaitingDays = oldestWaiting ? Math.max(0, differenceInCalendarDays(new Date(), oldestWaiting)) : 0;

  const selectTab = (next: ProjectTab) => {
    setTab(next);
    router.replace(next === "tableau" ? pathname : `${pathname}?vue=${next}`, { scroll: false });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-line bg-surface px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-start gap-4">
          <ProjectTile color={project.color} label={project.key} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[24px] font-semibold leading-tight tracking-tight">{project.name}</h1>
              <SelectMenu<ProjectStatus>
                label="Statut du projet"
                value={project.status}
                onChange={(value) =>
                  startTransition(async () => {
                    await updateProjectStatus(project.id, value);
                    toast.success(`Projet « ${PROJECT_STATUS_BY_VALUE[value].label} »`);
                  })
                }
                options={PROJECT_STATUSES.map((s) => ({
                  value: s.value,
                  label: s.label,
                  icon: <span className="size-2 rounded-full" style={{ backgroundColor: s.tone }} />,
                }))}
                trigger={
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ color: status.tone, backgroundColor: `color-mix(in srgb, ${status.tone} 12%, transparent)` }}
                  >
                    {status.label}
                  </span>
                }
              />
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
              {project.client && (
                <span title={project.client.contacts ?? undefined}>
                  {project.client.name}
                  {project.client.kind === "AGENCY" && <span className="text-faint"> (agence)</span>}
                </span>
              )}
              {project.endClient && <span>· {project.endClient}</span>}
              {project.siteUrl && (
                <a href={project.siteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  · {project.siteUrl.replace(/^https?:\/\//, "")}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </p>
            <p className="tabular mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
              <span><strong className="font-semibold">{open}</strong> ouvertes</span>
              {waiting > 0 && (
                <span className="text-st-waiting">
                  <strong className="font-semibold">{waiting}</strong> chez le client
                  <span className={cn("ml-1", oldestWaitingDays >= 5 && "font-semibold")}>
                    · la plus ancienne depuis {oldestWaitingDays === 0 ? "aujourd'hui" : `${oldestWaitingDays} j`}
                  </span>
                </span>
              )}
              {billable > 0 && <span><strong className="font-semibold">{billable}</strong> hors périmètre (€)</span>}
              {project.lead && (
                <span className="flex items-center gap-1.5">
                  <Avatar name={project.lead.name} color={project.lead.color} size={16} /> {project.lead.name}
                </span>
              )}
            </p>
            <ProjectNote projectId={project.id} note={project.statusNote} noteAt={project.statusNoteAt} />
          </div>

          <div className="flex flex-wrap gap-2">
            <GhostButton
              type="button"
              onClick={() => {
                setImportText("");
                setDialog("import");
              }}
            >
              <FileSpreadsheet className="size-4" />
              Importer des retours
            </GhostButton>
            <GhostButton type="button" onClick={() => setDialog("recap")}>
              <MessageSquareText className="size-4" />
              Récap client
            </GhostButton>
            <PrimaryButton type="button" onClick={() => setDialog("delivery")}>
              <Rocket className="size-4" />
              Mise en ligne
            </PrimaryButton>
          </div>
        </div>

        <nav className="mt-4 flex gap-5 overflow-x-auto scroll-thin" aria-label="Vues du projet">
          {(Object.keys(TAB_LABELS) as ProjectTab[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-current={tab === key ? "page" : undefined}
              onClick={() => selectTab(key)}
              className={cn(
                "-mb-px border-b-2 pb-2.5 text-[13px] font-medium transition-colors",
                tab === key ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
              )}
            >
              {TAB_LABELS[key]}
              {key === "mises-en-ligne" && project.deliveries.length > 0 && (
                <span className="tabular ml-1.5 text-[11px] text-faint">{project.deliveries.length}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <div className={cn("flex min-h-0 flex-1 flex-col pt-5", tab !== "tableau" && "overflow-y-auto scroll-thin")}>
        {tab === "tableau" && <Board projectId={project.id} projectKey={project.key} tasks={project.tasks} />}
        {tab === "liste" && (
          <TaskList projectId={project.id} projectKey={project.key} tasks={project.tasks} sourceFilter={sourceFilter} />
        )}
        {tab === "mises-en-ligne" && <Deliveries deliveries={project.deliveries} onAdd={() => setDialog("delivery")} />}
        {tab === "activite" && <ActivityFeed activities={project.activities} />}
      </div>

      {dialog === "import" && (
        <ImportDialog onClose={() => setDialog(null)} projectId={project.id} initialText={importText} />
      )}
      <RecapDialog
        open={dialog === "recap"}
        onClose={() => setDialog(null)}
        projectId={project.id}
        lastDeliveryAt={project.deliveries[0] ? new Date(project.deliveries[0].deployedAt).toISOString() : null}
      />
      <DeliveryDialog open={dialog === "delivery"} onClose={() => setDialog(null)} projectId={project.id} siteUrl={project.siteUrl} />
    </div>
  );
}

function Deliveries({ deliveries, onAdd }: { deliveries: ProjectData["deliveries"]; onAdd: () => void }) {
  if (deliveries.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6">
        <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <p className="font-display text-[17px] font-semibold">Aucune mise en ligne enregistrée</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">
            Enregistrez chaque mise en ligne avec son heure exacte : c&apos;est la preuve de ce qui a été livré, et quand.
          </p>
          <div className="mt-5 flex justify-center">
            <PrimaryButton type="button" onClick={onAdd}>
              <Rocket className="size-4" />
              Enregistrer une mise en ligne
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }
  return (
    <ol className="mx-auto w-full max-w-3xl px-6 pb-10">
      {deliveries.map((delivery, index) => (
        <li key={delivery.id} className="relative grid grid-cols-[132px_1fr] gap-5 pb-6">
          <time dateTime={new Date(delivery.deployedAt).toISOString()} className="tabular pt-0.5 text-right font-mono text-[12px] text-muted">
            {formatDateTime(delivery.deployedAt)}
          </time>
          <div className="relative border-l border-line pl-5">
            <span className={cn("absolute -left-[5px] top-1.5 size-2.5 rounded-full ring-4 ring-bg", index === 0 ? "bg-st-done" : "bg-line-strong")} />
            <p className="text-[14px] font-medium">{delivery.title}</p>
            {delivery.notes && <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{delivery.notes}</p>}
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-muted">
              {delivery.author && (
                <span className="flex items-center gap-1.5">
                  <Avatar name={delivery.author.name} color={delivery.author.color} size={16} /> {delivery.author.name}
                </span>
              )}
              {delivery.url && (
                <a href={delivery.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  Voir <ExternalLink className="size-3" />
                </a>
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ActivityFeed({ activities }: { activities: ProjectData["activities"] }) {
  if (activities.length === 0) {
    return <p className="mx-auto w-full max-w-3xl px-6 text-[13px] text-muted">Aucune activité pour l&apos;instant.</p>;
  }
  return (
    <ol className="mx-auto w-full max-w-3xl space-y-3 px-6 pb-10">
      {activities.map((activity) => (
        <li key={activity.id} className="flex items-start gap-3 text-[13px]">
          {activity.actor ? <Avatar name={activity.actor.name} color={activity.actor.color} size={22} /> : <span className="size-[22px]" />}
          <p className="min-w-0 flex-1 text-ink-2">
            <span className="font-medium text-ink">{activity.actor?.name ?? "Quelqu'un"}</span> {activity.message}
          </p>
          <time dateTime={new Date(activity.createdAt).toISOString()} title={formatDateTime(activity.createdAt)} className="shrink-0 text-[12px] text-faint">
            {timeAgo(activity.createdAt)}
          </time>
        </li>
      ))}
    </ol>
  );
}
