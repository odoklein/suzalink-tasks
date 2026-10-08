import { differenceInCalendarDays } from "date-fns";
import { ChevronRight, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NewProjectButton } from "@/components/new-project-button";
import { Avatar, DueChip, ProjectTile, StatusIcon } from "@/components/primitives";
import { Badge, type Tone } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { Tooltip } from "@/components/ui/tooltip";
import { PROJECT_STATUSES, PROJECT_STATUS_BY_VALUE, TASK_STATUSES } from "@/lib/constants";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatPercent } from "@/lib/fr";
import { plural } from "@/lib/plural";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Projets" };

type ProjectRow = Awaited<ReturnType<typeof loadProjects>>[number];

function loadProjects() {
  return db.project.findMany({
    where: { archived: false },
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { name: true } },
      lead: { select: { id: true, name: true, color: true } },
      tasks: { select: { status: true, dueDate: true, statusChangedAt: true } },
      deliveries: { orderBy: { deployedAt: "desc" }, take: 1, select: { deployedAt: true } },
    },
  });
}

const STATUS_TONE: Record<ProjectRow["status"], Tone> = { ACTIVE: "progress", WAITING_CLIENT: "waiting", PAUSED: "todo", DONE: "done" };

type Filters = { responsable?: string; client?: string; vue?: string };

/** Lien qui bascule un filtre dans l’URL (les autres sont conservés). */
function filterHref(current: Filters, key: keyof Filters, value: string) {
  const next = { ...current, [key]: current[key] === value ? undefined : value };
  const query = new URLSearchParams(Object.entries(next).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const text = query.toString();
  return text ? `/projects?${text}` : "/projects";
}

export default async function ProjectsPage(props: PageProps<"/projects">) {
  await verifySession();
  const all = await loadProjects();
  const params = await props.searchParams;
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const filters: Filters = { responsable: one(params.responsable), client: one(params.client), vue: one(params.vue) };
  const compactView = filters.vue === "compacte";

  const leads = [...new Map(all.filter((p) => p.lead).map((p) => [p.lead!.id, p.lead!])).values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const clientNames = [...new Set(all.map((p) => p.client?.name).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, "fr"));
  const projects = all.filter(
    (project) =>
      (!filters.responsable || project.lead?.id === filters.responsable) && (!filters.client || project.client?.name === filters.client),
  );

  const groups = PROJECT_STATUSES.map((status) => ({
    ...status,
    projects: projects.filter((project) => project.status === status.value),
  }));
  const live = projects.filter((project) => project.status !== "DONE");
  const waitingTotal = projects.flatMap((project) => project.tasks).filter((task) => task.status === "WAITING_CLIENT").length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[var(--page-wide)] px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-h1 font-semibold tracking-tight">Projets</h1>
            <p className="mt-1 text-body text-muted">
              {live.length} en cours
              {waitingTotal > 0 && <> · {plural(waitingTotal, "tâche")} chez les clients</>}
            </p>
          </div>
          <NewProjectButton />
        </div>

        {all.length > 0 && (
          <nav aria-label="Filtres" className="mt-5 flex flex-wrap items-center gap-1.5">
            {leads.map((lead) => (
              <Link
                key={lead.id}
                href={filterHref(filters, "responsable", lead.id)}
                aria-current={filters.responsable === lead.id ? "true" : undefined}
                className={cn(chipClass, filters.responsable === lead.id && chipActive)}
              >
                <Avatar name={lead.name} color={lead.color} size={18} />
                {lead.name.split(" ")[0]}
              </Link>
            ))}
            {leads.length > 0 && clientNames.length > 0 && <span aria-hidden="true" className="mx-1 h-4 w-px bg-line" />}
            {clientNames.map((name) => (
              <Link
                key={name}
                href={filterHref(filters, "client", name)}
                aria-current={filters.client === name ? "true" : undefined}
                className={cn(chipClass, filters.client === name && chipActive)}
              >
                {name}
              </Link>
            ))}
            <Link
              href={filterHref(filters, "vue", "compacte")}
              aria-pressed={compactView}
              className={cn(chipClass, "ml-auto", compactView && chipActive)}
            >
              Vue compacte
            </Link>
          </nav>
        )}

        {all.length > 0 && projects.length === 0 && (
          <p className="mt-8 text-ui text-muted">
            Aucun projet ne correspond à ces filtres. <Link href="/projects" className="text-accent hover:underline">Tout afficher</Link>
          </p>
        )}

        {compactView && projects.length > 0 && <CompactTable projects={projects} />}

        {all.length === 0 && (
          <div className="mt-10 rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
            <p className="text-title font-semibold tracking-[-0.01em]">Aucun projet</p>
            <p className="mt-1 text-ui text-muted">Créez le premier projet pour commencer à suivre les tâches.</p>
            <div className="mt-5 flex justify-center">
              <NewProjectButton />
            </div>
          </div>
        )}

        <div className={cn("mt-6 space-y-8", compactView && "hidden")}>
          {groups.map((group) => {
            if (group.projects.length === 0) return null;
            const delivered = group.value === "DONE";
            const list = (
              <ul className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3", delivered && "mt-3")}>
                {group.projects.map((project) => (
                  <li key={project.id}>
                    <ProjectCard project={project} compact={delivered} />
                  </li>
                ))}
              </ul>
            );

            return (
              <section key={group.value} aria-label={group.label}>
                {delivered ? (
                  <details className="group/details">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-muted [&::-webkit-details-marker]:hidden">
                      <ChevronRight className="size-3.5 transition-transform group-open/details:rotate-90" />
                      <SectionHeader as="h2" title={group.label} count={group.projects.length} className="mb-0" icon={<GroupDot tone={group.tone} />} />
                    </summary>
                    {list}
                  </details>
                ) : (
                  <>
                    <SectionHeader title={group.label} count={group.projects.length} className="mb-3" icon={<GroupDot tone={group.tone} />} />
                    {list}
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink";
const chipActive = "border-accent bg-accent-soft text-accent hover:border-accent hover:text-accent";

function GroupDot({ tone }: { tone: string }) {
  return <span className="size-2 rounded-full" style={{ backgroundColor: tone }} />;
}

/** Vue compacte : un tableau d’une ligne par projet. */
function CompactTable({ projects }: { projects: ProjectRow[] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface shadow-card">
      <table className="w-full min-w-[640px] text-left text-ui">
        <thead className="border-b border-line bg-surface-2 text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Projet</th>
            <th scope="col" className="px-3 py-2 font-medium">Client</th>
            <th scope="col" className="px-3 py-2 font-medium">Statut</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Ouvertes</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Chez le client</th>
            <th scope="col" className="px-3 py-2 font-medium">Responsable</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const open = project.tasks.filter((task) => task.status !== "DONE").length;
            const waiting = project.tasks.filter((task) => task.status === "WAITING_CLIENT").length;
            return (
              <tr key={project.id} className="border-b border-line last:border-b-0 hover:bg-surface-2">
                <td className="px-3 py-2">
                  <Link href={`/projects/${project.slug}`} className="flex items-center gap-2 font-medium hover:underline">
                    <ProjectTile color={project.color} label={project.key} size={16} />
                    {project.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted">{project.client?.name ?? "Interne"}</td>
                <td className="px-3 py-2">
                  <Badge tone={STATUS_TONE[project.status]}>{PROJECT_STATUS_BY_VALUE[project.status].label}</Badge>
                </td>
                <td className="tabular px-3 py-2 text-right">{open}</td>
                <td className={cn("tabular px-3 py-2 text-right", waiting ? "font-medium text-waiting-text" : "text-muted")}>{waiting}</td>
                <td className="px-3 py-2">
                  {project.lead ? (
                    <span className="flex items-center gap-1.5 text-muted">
                      <Avatar name={project.lead.name} color={project.lead.color} size={18} />
                      {project.lead.name.split(" ")[0]}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProjectCard({ project, compact }: { project: ProjectRow; compact: boolean }) {
  const total = project.tasks.length;
  const done = project.tasks.filter((task) => task.status === "DONE").length;
  const waitingTasks = project.tasks.filter((task) => task.status === "WAITING_CLIENT");
  const oldestWaiting = waitingTasks.length
    ? Math.max(0, differenceInCalendarDays(new Date(), new Date(Math.min(...waitingTasks.map((task) => task.statusChangedAt.getTime())))))
    : 0;
  const nextDue = project.tasks
    .filter((task) => task.status !== "DONE" && task.dueDate)
    .map((task) => task.dueDate as Date)
    .sort((a, b) => a.getTime() - b.getTime())[0];
  const lastDelivery = project.deliveries[0]?.deployedAt;

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group flex h-full flex-col rounded-lg border border-line bg-surface p-5 shadow-card outline-hidden transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-raised focus-visible:shadow-[var(--ring)]"
    >
      <div className="flex items-start gap-3">
        <ProjectTile color={project.color} label={project.key} size={34} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-title font-semibold tracking-[-0.01em] group-hover:text-accent">{project.name}</h3>
          <p className="truncate text-xs text-muted">
            {[project.client?.name, project.endClient].filter(Boolean).join(" · ") || "Projet interne"}
          </p>
        </div>
      </div>

      {project.statusNote ? (
        <p className={cn("mt-4 rounded-md bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2", compact ? "line-clamp-2" : "line-clamp-3")}>
          {project.statusNote}
          {project.statusNoteAt && <span className="ml-1.5 whitespace-nowrap text-meta text-muted">· {timeAgo(project.statusNoteAt)}</span>}
        </p>
      ) : (
        // Toute la carte mène au projet, où le point d’étape se saisit : pas de lien imbriqué.
        !compact && <p className="mt-4 text-xs text-muted underline decoration-dotted underline-offset-2 group-hover:text-accent">Ajouter un point d&apos;étape</p>
      )}

      {!compact && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted">Avancement</span>
            <span className="tabular font-medium">
              {done}/{total}
              <span className="ml-1.5 text-muted">{formatPercent(total ? done / total : 0)}</span>
            </span>
          </div>
          <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${done} tâches faites sur ${total}`}>
            {TASK_STATUSES.slice()
              .reverse()
              .map((s) => {
                const count = project.tasks.filter((task) => task.status === s.value).length;
                return count ? <span key={s.value} style={{ flex: count, backgroundColor: s.tone }} /> : null;
              })}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs text-muted">
        {waitingTasks.length > 0 && (
          <span className={cn("flex items-center gap-1 font-medium text-waiting-text", oldestWaiting >= 5 && "rounded-sm bg-waiting-soft px-1.5 py-0.5")}>
            <StatusIcon status="WAITING_CLIENT" size={14} />
            {waitingTasks.length} chez le client{oldestWaiting >= 1 && ` · ${oldestWaiting} j`}
          </span>
        )}
        {lastDelivery && (
          <Tooltip content="Dernière mise en ligne">
            <span className="flex items-center gap-1">
              <Rocket className="size-3.5" />
              {timeAgo(lastDelivery)}
            </span>
          </Tooltip>
        )}
        {nextDue && <DueChip date={nextDue} />}
        {project.lead && (
          <span className="ml-auto">
            <Avatar name={project.lead.name} color={project.lead.color} size={22} />
          </span>
        )}
      </div>
    </Link>
  );
}
