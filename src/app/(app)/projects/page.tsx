import { differenceInCalendarDays } from "date-fns";
import { ChevronRight, Hourglass, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NewProjectButton } from "@/components/new-project-button";
import { Avatar, DueChip, ProjectTile } from "@/components/primitives";
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
      lead: { select: { name: true, color: true } },
      tasks: { select: { status: true, dueDate: true, statusChangedAt: true } },
      deliveries: { orderBy: { deployedAt: "desc" }, take: 1, select: { deployedAt: true } },
    },
  });
}

export default async function ProjectsPage() {
  await verifySession();
  const projects = await loadProjects();

  const groups = PROJECT_STATUSES.map((status) => ({
    ...status,
    projects: projects.filter((project) => project.status === status.value),
  }));
  const live = projects.filter((project) => project.status !== "DONE");
  const waitingTotal = projects.flatMap((project) => project.tasks).filter((task) => task.status === "WAITING_CLIENT").length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight">Projets</h1>
            <p className="mt-1 text-[14px] text-muted">
              {live.length} en cours
              {waitingTotal > 0 && <> · {plural(waitingTotal, "tâche")} chez les clients</>}
            </p>
          </div>
          <NewProjectButton />
        </div>

        {projects.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
            <p className="font-display text-[18px] font-semibold">Aucun projet</p>
            <p className="mt-1 text-[13px] text-muted">Créez le premier projet pour commencer à suivre les tâches.</p>
            <div className="mt-5 flex justify-center">
              <NewProjectButton />
            </div>
          </div>
        )}

        <div className="mt-6 space-y-8">
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
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-faint [&::-webkit-details-marker]:hidden">
                      <ChevronRight className="size-3.5 transition-transform group-open/details:rotate-90" />
                      <GroupTitle label={group.label} tone={group.tone} count={group.projects.length} />
                    </summary>
                    {list}
                  </details>
                ) : (
                  <>
                    <h2 className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-faint">
                      <GroupTitle label={group.label} tone={group.tone} count={group.projects.length} />
                    </h2>
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

function GroupTitle({ label, tone, count }: { label: string; tone: string; count: number }) {
  return (
    <>
      <span className="size-2 rounded-full" style={{ backgroundColor: tone }} />
      {label}
      <span className="tabular font-normal">{count}</span>
    </>
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
  const status = PROJECT_STATUS_BY_VALUE[project.status];
  const lastDelivery = project.deliveries[0]?.deployedAt;

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 shadow-card transition-[border-color,transform] hover:-translate-y-0.5 hover:border-line-strong"
    >
      <div className="flex items-start gap-3">
        <ProjectTile color={project.color} label={project.key} size={34} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[17px] font-semibold tracking-tight group-hover:text-accent">{project.name}</h3>
          <p className="truncate text-[12px] text-muted">
            {[project.client?.name, project.endClient].filter(Boolean).join(" · ") || "Projet interne"}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ color: status.tone, backgroundColor: `color-mix(in srgb, ${status.tone} 12%, transparent)` }}
        >
          {status.label}
        </span>
      </div>

      {project.statusNote ? (
        <p className={cn("mt-4 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-ink-2", compact ? "line-clamp-2" : "line-clamp-5")}>
          {project.statusNote}
          {project.statusNoteAt && <span className="ml-1.5 whitespace-nowrap text-[11px] text-faint">· {timeAgo(project.statusNoteAt)}</span>}
        </p>
      ) : (
        !compact && <p className="mt-4 rounded-lg border border-dashed border-line px-3 py-2 text-[12px] text-faint">Pas encore de point d&apos;étape</p>
      )}

      {!compact && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-[12px]">
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

      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-[12px] text-muted">
        {waitingTasks.length > 0 && (
          <span className={cn("flex items-center gap-1 font-medium text-st-waiting", oldestWaiting >= 5 && "rounded-md bg-[color-mix(in_srgb,var(--st-waiting)_14%,transparent)] px-1.5 py-0.5")}>
            <Hourglass className="size-3.5" />
            {waitingTasks.length} chez le client{oldestWaiting >= 1 && ` · ${oldestWaiting} j`}
          </span>
        )}
        {lastDelivery && (
          <span className="flex items-center gap-1" title="Dernière mise en ligne">
            <Rocket className="size-3.5" />
            {timeAgo(lastDelivery)}
          </span>
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
