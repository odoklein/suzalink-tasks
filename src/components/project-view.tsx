"use client";

import type { ClientKind, ProjectStatus } from "@prisma/client";
import { ChevronDown, ExternalLink, FileSpreadsheet, MessageSquareText, MoreHorizontal, Rocket } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateProjectStatus } from "@/app/actions/projects";
import { Board } from "@/components/board";
import { NewTaskButton } from "@/components/new-task-button";
import { Avatar, ProjectTile, StatusIcon } from "@/components/primitives";
import { ProjectNote } from "@/components/project-note";
import { DeliveryDialog, ImportDialog, RecapDialog } from "@/components/project-dialogs";
import { SelectMenu } from "@/components/select-menu";
import { TaskList } from "@/components/task-list";
import { ActionMenu } from "@/components/ui/action-menu";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button, buttonClass, IconButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { TabPanel, Tabs, useTabIds } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { PROJECT_STATUSES, PROJECT_STATUS_BY_VALUE } from "@/lib/constants";
import type { TaskCard } from "@/lib/types";
import { PROJECT_ACTION_EVENT, type ProjectAction } from "@/lib/project-actions";
import { oldestWaitingDays as oldestWaitingOf } from "@/lib/waiting";
import { formatParis } from "@/lib/time";
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
  dueDate: Date | null;
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

const STATUS_TONE: Record<ProjectStatus, Tone> = {
  ACTIVE: "progress",
  WAITING_CLIENT: "waiting",
  PAUSED: "todo",
  DONE: "done",
};

const TAB_LABELS: Record<ProjectTab, string> = {
  tableau: "Tableau",
  liste: "Liste",
  "mises-en-ligne": "Mises en ligne",
  activite: "Activité",
};

export function ProjectView({ project, initialTab }: { project: ProjectData; initialTab: ProjectTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<ProjectTab>(initialTab);
  const [dialog, setDialog] = useState<"import" | "recap" | "delivery" | null>(null);
  const [, startTransition] = useTransition();
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Actions demandées par la palette ou les raccourcis clavier.
  useEffect(() => {
    const onAction = (event: Event) => {
      const action = (event as CustomEvent<ProjectAction>).detail;
      if (action === "import" || action === "recap" || action === "delivery") setDialog(action);
    };
    window.addEventListener(PROJECT_ACTION_EVENT, onAction);
    return () => window.removeEventListener(PROJECT_ACTION_EVENT, onAction);
  }, []);
  const tabIds = useTabIds();

  const open = project.tasks.filter((task) => task.status !== "DONE").length;
  const waiting = project.tasks.filter((task) => task.status === "WAITING_CLIENT").length;
  const billable = project.tasks.filter((task) => task.billable).length;
  const status = PROJECT_STATUS_BY_VALUE[project.status];
  const oldestWaitingDays = oldestWaitingOf(project.tasks);

  const actions = [
    { label: "Importer des retours", icon: <FileSpreadsheet />, onSelect: () => setDialog("import") },
    { label: "Récap client", icon: <MessageSquareText />, onSelect: () => setDialog("recap") },
    { label: "Mise en ligne", icon: <Rocket />, onSelect: () => setDialog("delivery") },
  ] as const;

  const selectTab = (next: ProjectTab) => {
    setTab(next);
    router.replace(next === "tableau" ? pathname : `${pathname}?vue=${next}`, { scroll: false });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-line bg-surface px-4 pt-4 sm:px-8">
        {/* Rangée 1 : identité du projet et actions */}
        <div className="flex items-center gap-3">
          <ProjectTile color={project.color} label={project.key} size={32} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="truncate font-display text-h2 font-semibold tracking-tight">{project.name}</h1>
            <SelectMenu<ProjectStatus>
              label="Statut du projet"
              value={project.status}
              onChange={(value) =>
                startTransition(async () => {
                  const result = await updateProjectStatus(project.id, value);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(`Projet « ${PROJECT_STATUS_BY_VALUE[value].label} »`);
                })
              }
              options={PROJECT_STATUSES.map((s) => ({
                value: s.value,
                label: s.label,
                icon: <span className="size-2 rounded-full" style={{ backgroundColor: s.tone }} />,
              }))}
              trigger={<Badge tone={STATUS_TONE[project.status]}>{status.label}</Badge>}
            />
            {project.siteUrl && (
              <Tooltip content={project.siteUrl.replace(/^https?:\/\//, "")}>
                <a
                  href={project.siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Ouvrir le site (nouvel onglet)"
                  className={buttonClass({ variant: "ghost", size: "icon", className: "size-7 text-muted" })}
                >
                  <ExternalLink className="size-4" />
                </a>
              </Tooltip>
            )}
            <p className={cn("flex min-w-0 flex-wrap items-center gap-x-2 text-ui text-muted", !detailsOpen && "max-md:hidden")}>
              {project.client && (
                <Tooltip content={project.client.contacts}>
                  <span>
                    {project.client.name}
                    {project.client.kind === "AGENCY" && " (agence)"}
                  </span>
                </Tooltip>
              )}
              {project.endClient && <span>· {project.endClient}</span>}
              {project.dueDate && (
                <Chip muted className="tabular px-0" icon={<span aria-hidden="true">·</span>}>
                  Échéance {formatParis(project.dueDate, "d MMM yyyy")}
                </Chip>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              {actions.map((action) => (
                <Button key={action.label} size="sm" icon={action.icon} onClick={action.onSelect} className="[&>svg]:size-3.5">
                  {action.label}
                </Button>
              ))}
            </div>
            <div className="lg:hidden">
              <ActionMenu
                label="Actions du projet"
                items={[...actions]}
                trigger={(props) => (
                  <Button {...props} size="sm" aria-label="Actions du projet" className="size-7 px-0">
                    <MoreHorizontal className="size-4" />
                  </Button>
                )}
              />
            </div>
            <NewTaskButton />
            <IconButton
              label={detailsOpen ? "Masquer les détails" : "Afficher les détails"}
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((value) => !value)}
              className="md:hidden"
            >
              <ChevronDown className={cn("size-4 transition-transform", detailsOpen && "rotate-180")} />
            </IconButton>
          </div>
        </div>

        {/* Rangée 2 : point d’étape sur une ligne */}
        <div className={cn(!detailsOpen && "max-md:hidden")}>
          <ProjectNote projectId={project.id} note={project.statusNote} noteAt={project.statusNoteAt} />
        </div>

        {/* Rangée 3 : onglets et indicateurs */}
        <div className="mt-2 flex items-end gap-4">
          <Tabs
            label="Vues du projet"
            idBase={tabIds}
            value={tab}
            onChange={selectTab}
            className="min-w-0 flex-1"
            tabs={(Object.keys(TAB_LABELS) as ProjectTab[]).map((key) => ({
              value: key,
              label: TAB_LABELS[key],
              count: key === "tableau" ? open : key === "mises-en-ligne" && project.deliveries.length > 0 ? project.deliveries.length : undefined,
            }))}
          />
          <div className="hidden shrink-0 items-center gap-2 pb-2 sm:flex">
            {waiting > 0 && (
              <Tooltip content={`${waiting} chez le client, la plus ancienne depuis ${oldestWaitingDays} j`}>
                <Badge
                  tone="waiting"
                  variant={oldestWaitingDays >= 5 ? "solid" : "soft"}
                  icon={<StatusIcon status="WAITING_CLIENT" size={12} />}
                  className="tabular"
                >
                  {waiting} · {oldestWaitingDays} j
                </Badge>
              </Tooltip>
            )}
            {billable > 0 && (
              <Tooltip content={`${billable} hors périmètre (€)`}>
                <Badge className="tabular">€ {billable}</Badge>
              </Tooltip>
            )}
            {project.lead && (
              <Tooltip content={`Responsable : ${project.lead.name}`}>
                <span>
                  <Avatar name={project.lead.name} color={project.lead.color} size={22} />
                </span>
              </Tooltip>
            )}
          </div>
        </div>
      </header>

      <TabPanel
        idBase={tabIds}
        value={tab}
        active
        className={cn("flex min-h-0 flex-1 flex-col pt-5", tab !== "tableau" && "overflow-y-auto scroll-thin")}
      >
        {tab === "tableau" && <Board projectId={project.id} projectKey={project.key} tasks={project.tasks} />}
        {tab === "liste" && <TaskList projectId={project.id} projectKey={project.key} tasks={project.tasks} />}
        {tab === "mises-en-ligne" && <Deliveries deliveries={project.deliveries} onAdd={() => setDialog("delivery")} />}
        {tab === "activite" && <ActivityFeed activities={project.activities} />}
      </TabPanel>

      <ImportDialog open={dialog === "import"} onClose={() => setDialog(null)} projectId={project.id} />
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
      <div className="mx-auto w-full max-w-[var(--page-narrow)] px-4 sm:px-8">
        <EmptyState
          icon={<Rocket />}
          tone="done"
          title="Aucune mise en ligne enregistrée"
          className="rounded-lg border border-dashed border-line-strong bg-surface"
          action={
            <Button variant="primary" icon={<Rocket className="size-4" />} onClick={onAdd}>
              Enregistrer une mise en ligne
            </Button>
          }
        >
          Enregistrez chaque mise en ligne avec son heure exacte : c&apos;est la preuve de ce qui a été livré, et quand.
        </EmptyState>
      </div>
    );
  }
  return (
    <ol className="mx-auto w-full max-w-[var(--page-narrow)] px-4 sm:px-8 pb-10">
      {deliveries.map((delivery, index) => (
        <li key={delivery.id} className="grid grid-cols-[88px_1fr] gap-5">
          {/* Deux lignes : « 7 oct. » en encre, « 15h21 » en discret ; heure de Paris des deux côtés. */}
          <time dateTime={new Date(delivery.deployedAt).toISOString()} className="tabular pt-0.5 text-right text-xs leading-tight">
            <span className="block font-medium text-ink">{formatParis(delivery.deployedAt, "d MMM")}</span>
            <span className="block text-muted">{formatParis(delivery.deployedAt, "HH'h'mm")}</span>
          </time>
          {/* La ligne est portée par la colonne de contenu, padding compris : plus de trous entre les items. */}
          <div className={cn("relative border-l pb-6 pl-5", index === deliveries.length - 1 ? "border-transparent" : "border-line")}>
            <span className={cn("absolute -left-[5px] top-1.5 size-2.5 rounded-full ring-4 ring-bg", index === 0 ? "bg-done" : "bg-line-strong")} />
            <p className="text-body font-medium">{delivery.title}</p>
            {delivery.notes && <p className="mt-1 whitespace-pre-wrap text-ui leading-relaxed text-ink-2">{delivery.notes}</p>}
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
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
    return <p className="mx-auto w-full max-w-[var(--page-narrow)] px-4 sm:px-8 text-ui text-muted">Aucune activité pour l&apos;instant.</p>;
  }
  return (
    <ol className="mx-auto w-full max-w-[var(--page-narrow)] space-y-3 px-4 sm:px-8 pb-10">
      {activities.map((activity) => (
        <li key={activity.id} className="flex items-start gap-3 text-ui">
          {activity.actor ? <Avatar name={activity.actor.name} color={activity.actor.color} size={22} /> : <span className="size-[22px]" />}
          <p className="min-w-0 flex-1 text-ink-2">
            <span className="font-medium text-ink">{activity.actor?.name ?? "Quelqu'un"}</span> {activity.message}
          </p>
          <Tooltip content={formatDateTime(activity.createdAt)}>
            <time dateTime={new Date(activity.createdAt).toISOString()} className="shrink-0 text-xs text-muted">
              {timeAgo(activity.createdAt)}
            </time>
          </Tooltip>
        </li>
      ))}
    </ol>
  );
}
