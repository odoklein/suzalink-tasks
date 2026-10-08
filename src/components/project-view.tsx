"use client";

import type { ActivityType, ClientKind, MessageKind, ProjectStatus } from "@prisma/client";
import { ChevronDown, ExternalLink, FileSpreadsheet, MessageSquareText, MoreHorizontal, Rocket } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteDelivery, restoreDelivery } from "@/app/actions/deliveries";
import { updateProjectStatus } from "@/app/actions/projects";
import { Board } from "@/components/board";
import { ChaseButton } from "@/components/chase-dialog";
import { CopyEmailButton } from "@/components/copy-email-button";
import { DeliveryDialog, type EditableDelivery } from "@/components/delivery-dialog";
import { ExtrasView, type ExtraData } from "@/components/extras-view";
import { ImportDialog } from "@/components/import-dialog";
import { NewTaskButton } from "@/components/new-task-button";
import { Avatar, ProjectTile, StatusIcon } from "@/components/primitives";
import { ProjectNote } from "@/components/project-note";
import { RecapDialog } from "@/components/recap-dialog";
import { RoundsView, type RoundData } from "@/components/rounds-view";
import { SelectMenu } from "@/components/select-menu";
import { TaskList } from "@/components/task-list";
import { ActionMenu } from "@/components/ui/action-menu";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button, buttonClass, IconButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { TabPanel, Tabs, useTabIds } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { chaseLabel, chaseState, waitingStart } from "@/lib/chasing";
import { PROJECT_STATUSES, PROJECT_STATUS_BY_VALUE } from "@/lib/constants";
import { looksLikeTable } from "@/lib/feedback-import";
import { plural } from "@/lib/plural";
import { PROJECT_ACTION_EVENT, type ProjectAction } from "@/lib/project-actions";
import { formatParis } from "@/lib/time";
import type { TaskCard } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export type ProjectTab = "tableau" | "liste" | "retours" | "avenants" | "mises-en-ligne" | "activite";

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
  client: {
    name: string;
    kind: ClientKind;
    contacts: string | null;
    /** Contact principal (le premier, déjà trié côté serveur). */
    contactRecords: { id: string; name: string; role: string | null; email: string | null }[];
  } | null;
  lead: { name: string; color: string } | null;
  tasks: TaskCard[];
  deliveries: {
    id: string;
    title: string;
    notes: string | null;
    url: string | null;
    deployedAt: Date;
    author: { name: string; color: string } | null;
    tasks: { task: { id: string; number: number; title: string; zone: string | null } }[];
  }[];
  activities: {
    id: string;
    type: ActivityType;
    data: unknown;
    message: string;
    createdAt: Date;
    actor: { name: string; color: string } | null;
  }[];
  lastChasedAt: Date | null;
  /** Messages envoyés au client (relances, récaps), pour les déplier dans l'historique. */
  clientMessages: { id: string; body: string; kind: MessageKind; sentAt: Date }[];
  rounds: RoundData[];
  extras: ExtraData[];
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
  retours: "Retours",
  avenants: "Avenants",
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
  const [editingDelivery, setEditingDelivery] = useState<EditableDelivery | null>(null);
  const [importText, setImportText] = useState("");
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
  const primary = project.client?.contactRecords[0] ?? null;

  const [now] = useState(() => new Date());
  const oldestWaiting = project.tasks
    .filter((task) => task.status === "WAITING_CLIENT")
    .reduce<Date | null>((oldest, task) => {
      const since = new Date(waitingStart(task));
      return !oldest || since < oldest ? since : oldest;
    }, null);
  const oldestWaitingDays = oldestWaiting
    ? Math.max(0, Math.floor((now.getTime() - oldestWaiting.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const chase = chaseState(project.tasks, project.lastChasedAt, now);
  const chaseText = chaseLabel(chase, now);

  const actions = [
    { label: "Importer des retours", icon: <FileSpreadsheet />, onSelect: () => setDialog("import") },
    { label: "Récap client", icon: <MessageSquareText />, onSelect: () => setDialog("recap") },
    { label: "Mise en ligne", icon: <Rocket />, onSelect: () => setDialog("delivery") },
  ] as const;

  const selectTab = (next: ProjectTab) => {
    setTab(next);
    router.replace(next === "tableau" ? pathname : `${pathname}?vue=${next}`, { scroll: false });
  };

  const openRoundsCount = project.rounds.filter((round) => round.status === "OPEN").length;
  const openExtrasCount = project.extras.filter((extra) => extra.status !== "PAID").length;

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
                    {project.client.kind === "AGENCY" && <span className="text-muted"> (agence)</span>}
                  </span>
                </Tooltip>
              )}
              {primary ? (
                <span className="inline-flex items-center gap-1">
                  · {primary.name}
                  {primary.role && <span className="text-muted"> ({primary.role})</span>}
                  {primary.email && <CopyEmailButton email={primary.email} />}
                </span>
              ) : (
                project.client?.contacts && <span>· {project.client.contacts}</span>
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
              count:
                key === "tableau"
                  ? open
                  : key === "retours" && openRoundsCount > 0
                    ? openRoundsCount
                    : key === "avenants" && openExtrasCount > 0
                      ? openExtrasCount
                      : key === "mises-en-ligne" && project.deliveries.length > 0
                        ? project.deliveries.length
                        : undefined,
            }))}
          />
          <div className="hidden shrink-0 items-center gap-2 pb-2 sm:flex">
            {waiting > 0 && (
              <div className="flex items-center gap-1.5">
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
                {chaseText && (
                  <span className="text-meta text-waiting-text font-medium">
                    {chaseText}
                  </span>
                )}
                <ChaseButton projectId={project.id} projectName={project.name} compact />
              </div>
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
        {tab === "liste" && (
          <TaskList projectId={project.id} projectKey={project.key} tasks={project.tasks} sourceFilter={sourceFilter} />
        )}
        {tab === "retours" && (
          <RoundsView
            projectId={project.id}
            rounds={project.rounds}
            tasks={project.tasks}
            deliveries={project.deliveries}
            onImport={() => {
              setImportText("");
              setDialog("import");
            }}
          />
        )}
        {tab === "avenants" && (
          <ExtrasView
            projectId={project.id}
            projectKey={project.key}
            extras={project.extras}
            tasks={project.tasks}
          />
        )}
        {tab === "mises-en-ligne" && (
          <Deliveries
            deliveries={project.deliveries}
            projectKey={project.key}
            onAdd={() => {
              setEditingDelivery(null);
              setDialog("delivery");
            }}
            onEdit={(delivery) => {
              setEditingDelivery({
                id: delivery.id,
                title: delivery.title,
                notes: delivery.notes,
                url: delivery.url,
                deployedAt: new Date(delivery.deployedAt),
                taskIds: delivery.tasks.map(({ task }) => task.id),
              });
              setDialog("delivery");
            }}
          />
        )}
        {tab === "activite" && <ActivityFeed activities={project.activities} messages={project.clientMessages} />}
      </TabPanel>

      {dialog === "import" && (
        <ImportDialog
          onClose={() => setDialog(null)}
          projectId={project.id}
          initialText={importText}
          contacts={project.client?.contactRecords ?? []}
        />
      )}
      {dialog === "recap" && <RecapDialog onClose={() => setDialog(null)} projectId={project.id} />}
      {dialog === "delivery" && (
        <DeliveryDialog
          onClose={() => setDialog(null)}
          onSaved={() =>
            toast.success("Mise en ligne enregistrée", {
              action: { label: "Préparer le récap client →", onClick: () => setDialog("recap") },
              duration: 8000,
            })
          }
          projectId={project.id}
          projectKey={project.key}
          siteUrl={project.siteUrl}
          tasks={project.tasks}
          rounds={project.rounds}
          previousDeliveryAt={project.deliveries[0] ? new Date(project.deliveries[0].deployedAt) : null}
          editing={editingDelivery ?? undefined}
        />
      )}
    </div>
  );
}

function Deliveries({
  deliveries,
  projectKey,
  onAdd,
  onEdit,
}: {
  deliveries: ProjectData["deliveries"];
  projectKey: string;
  onAdd: () => void;
  onEdit: (delivery: ProjectData["deliveries"][number]) => void;
}) {
  const remove = async (delivery: ProjectData["deliveries"][number]) => {
    const result = await deleteDelivery(delivery.id);
    if (!result.ok) return;
    toast.success(`Mise en ligne « ${delivery.title} » supprimée`, {
      duration: 8000,
      action: {
        label: "Annuler",
        onClick: async () => {
          await restoreDelivery(delivery.id);
          toast.success("Mise en ligne restaurée");
        },
      },
    });
  };

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
              <button type="button" onClick={() => onEdit(delivery)} className="hover:text-ink hover:underline">
                Modifier
              </button>
              <button type="button" onClick={() => remove(delivery)} className="hover:text-danger hover:underline">
                Supprimer
              </button>
            </p>
            {delivery.tasks.length > 0 && (
              <details className="mt-2 text-[12px]">
                <summary className="cursor-pointer text-muted hover:text-ink">{plural(delivery.tasks.length, "tâche livrée", "tâches livrées")}</summary>
                <ul className="mt-1 space-y-0.5">
                  {delivery.tasks.map(({ task }) => (
                    <li key={task.id} className="flex items-baseline gap-2 text-ink-2">
                      <span className="font-mono text-[11px] text-muted">{projectKey}-{task.number}</span>
                      {task.zone && <span className="text-muted">{task.zone} ·</span>}
                      <span className="min-w-0 truncate">{task.title}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ActivityFeed({
  activities,
  messages,
}: {
  activities: ProjectData["activities"];
  messages: ProjectData["clientMessages"];
}) {
  if (activities.length === 0) {
    return <p className="mx-auto w-full max-w-[var(--page-narrow)] px-4 sm:px-8 text-ui text-muted">Aucune activité pour l&apos;instant.</p>;
  }
  const bodies = new Map(messages.map((message) => [message.id, message.body]));
  return (
    <ol className="mx-auto w-full max-w-[var(--page-narrow)] space-y-3 px-4 sm:px-8 pb-10">
      {activities.map((activity) => {
        const messageId =
          activity.type === "CLIENT_MESSAGE" && activity.data && typeof activity.data === "object"
            ? (activity.data as { messageId?: string }).messageId
            : undefined;
        const body = messageId ? bodies.get(messageId) : undefined;
        return (
          <li key={activity.id} className="flex items-start gap-3 text-ui">
            {activity.actor ? <Avatar name={activity.actor.name} color={activity.actor.color} size={22} /> : <span className="size-[22px]" />}
            <div className="min-w-0 flex-1 text-ink-2">
              <p>
                <span className="font-medium text-ink">{activity.actor?.name ?? "Quelqu'un"}</span> {activity.message}
              </p>
              {body && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-muted hover:text-ink">Voir le message</summary>
                  <p className="mt-1 whitespace-pre-wrap rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed">{body}</p>
                </details>
              )}
            </div>
            <Tooltip content={formatDateTime(activity.createdAt)}>
              <time dateTime={new Date(activity.createdAt).toISOString()} className="shrink-0 text-xs text-muted">
                {timeAgo(activity.createdAt)}
              </time>
            </Tooltip>
          </li>
        );
      })}
    </ol>
  );
}
