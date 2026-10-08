import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  subDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { AlarmClock, CalendarDays, Rocket, UserRoundPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NewTaskButton } from "@/components/new-task-button";
import { AgeChip, Avatar, ProjectTile, StatusIcon } from "@/components/primitives";
import { Tooltip } from "@/components/ui/tooltip";
import { TaskRow } from "@/components/task-row";
import { projectSwatchVars } from "@/lib/color";
import { TASK_STATUSES } from "@/lib/constants";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { taskCardSelect, type TaskCard } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Aujourd'hui" };

type TaskWithProject = TaskCard & { project: { key: string; name: string; color: string; slug: string } };

const withProject = {
  ...taskCardSelect,
  project: { select: { key: true, name: true, color: true, slug: true } },
} as const;

export default async function TodayPage() {
  const user = await getCurrentUser();
  const now = new Date();
  const today = startOfDay(now);
  const endToday = endOfDay(now);
  const endWeek = endOfDay(addDays(now, 6));
  const live = { archived: false };

  const [mine, waiting, review, deliveries, deliveredThisWeek, activeProjects, unassigned, unassignedCount, workload, team] = await Promise.all([
    db.task.findMany({
      where: { assigneeId: user.id, status: { not: "DONE" }, project: live },
      select: withProject,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { updatedAt: "desc" }],
    }),
    db.task.findMany({
      where: { status: "WAITING_CLIENT", project: live },
      select: withProject,
      orderBy: { statusChangedAt: "asc" },
    }),
    db.task.findMany({
      where: { status: "REVIEW", project: live },
      select: withProject,
      orderBy: { updatedAt: "asc" },
      take: 8,
    }),
    db.delivery.findMany({
      orderBy: { deployedAt: "desc" },
      take: 5,
      include: { project: { select: { name: true, color: true, key: true, slug: true } } },
    }),
    db.delivery.count({ where: { deployedAt: { gte: subDays(today, 6) } } }),
    db.project.findMany({
      where: { ...live, status: { not: "DONE" } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        slug: true,
        key: true,
        color: true,
        statusNote: true,
        tasks: { select: { status: true } },
      },
    }),
    db.task.findMany({
      where: { assigneeId: null, status: { notIn: ["DONE", "WAITING_CLIENT"] }, project: live },
      select: withProject,
      orderBy: [{ priority: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 8,
    }),
    db.task.count({ where: { assigneeId: null, status: { notIn: ["DONE", "WAITING_CLIENT"] }, project: live } }),
    db.task.groupBy({
      by: ["assigneeId"],
      where: { assigneeId: { not: null }, status: { not: "DONE" }, project: live },
      _count: { _all: true },
    }),
    db.user.findMany({ select: { id: true, name: true, color: true }, orderBy: { name: "asc" } }),
  ]);

  const overdue = mine.filter((task) => task.dueDate && task.dueDate < today);
  const dueToday = mine.filter((task) => task.dueDate && task.dueDate >= today && task.dueDate <= endToday);
  const thisWeek = mine.filter((task) => task.dueDate && task.dueDate > endToday && task.dueDate <= endWeek);
  const later = mine.filter((task) => !task.dueDate || task.dueDate > endWeek);

  const oldestWaitingDays = waiting.length ? differenceInCalendarDays(now, waiting[0].statusChangedAt) : 0;
  const waitingByProject = new Map<string, TaskWithProject[]>();
  for (const task of waiting) {
    waitingByProject.set(task.project.slug, [...(waitingByProject.get(task.project.slug) ?? []), task]);
  }

  const week = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(today, index);
    return { day, tasks: mine.filter((task) => task.dueDate && isSameDay(task.dueDate, day)) };
  });

  const loadByUser = new Map(workload.map((row) => [row.assigneeId, row._count._all]));
  const teamLoad = team
    .map((member) => ({ ...member, open: loadByUser.get(member.id) ?? 0 }))
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
  const maxLoad = Math.max(1, ...teamLoad.map((member) => member.open));

  const firstName = user.name.split(" ")[0];
  // Les serveurs tournent en UTC : l'heure et la date affichées suivent Paris.
  const parisHour = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(now));
  const parisDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(now);
  const greeting = parisHour < 12 ? "Bonjour" : parisHour < 18 ? "Bon après-midi" : "Bonsoir";
  const summary = [
    overdue.length && `${overdue.length} en retard`,
    dueToday.length && `${dueToday.length} pour aujourd'hui`,
    waiting.length && `${waiting.length} bloquées côté client`,
    unassignedCount && `${unassignedCount} à attribuer`,
  ].filter(Boolean);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[var(--page-wide)] px-4 pb-12 pt-6 sm:px-8 sm:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-ui font-medium capitalize text-muted">{parisDate}</p>
            <h1 className="mt-1 font-display text-hero font-semibold leading-tight tracking-tight">
              {greeting} {firstName}
            </h1>
            <p className="mt-1 text-body text-ink-2">
              {summary.length ? `${summary.join(" · ")}.` : "Rien d'urgent : bonne journée pour avancer."}
            </p>
          </div>
          <NewTaskButton />
        </header>

        {/* Chiffres clés */}
        <section aria-label="Chiffres clés" className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={<AlarmClock className="size-4" />}
            tone={overdue.length ? "var(--danger)" : "var(--todo)"}
            label="En retard"
            value={overdue.length}
            hint={overdue.length ? "À traiter en premier" : "Rien en retard"}
          />
          <Stat icon={<CalendarDays className="size-4" />} tone="var(--progress)" label="Aujourd'hui" value={dueToday.length} hint={`${thisWeek.length} d'ici 7 jours`} />
          <Stat
            icon={<StatusIcon status="WAITING_CLIENT" size={16} />}
            tone="var(--waiting)"
            label="Chez le client"
            value={waiting.length}
            hint={waiting.length ? `La plus ancienne : ${oldestWaitingDays} j` : "Rien en attente"}
          />
          <Stat icon={<Rocket className="size-4" />} tone="var(--done)" label="Mises en ligne" value={deliveredThisWeek} hint="Sur les 7 derniers jours" />
        </section>

        {/* Les 7 prochains jours */}
        <section aria-label="Les 7 prochains jours" className="mt-3 grid grid-cols-7 gap-1.5 rounded-lg border border-line bg-surface p-1.5 shadow-card">
          {week.map(({ day, tasks }, index) => (
            <div
              key={day.toISOString()}
              title={tasks.map((task) => `${task.project.key}-${task.number} ${task.title}`).join("\n") || "Aucune échéance"}
              className={cn("rounded-md px-2.5 py-2", index === 0
                  ? "bg-ink text-bg dark:bg-accent-soft dark:text-accent dark:ring-1 dark:ring-accent/30"
                  : "hover:bg-surface-2")}
            >
              <p className={cn("text-meta font-medium capitalize", index === 0 ? "text-bg/70" : "text-muted")}>
                {index === 0 ? "Auj." : format(day, "EEE", { locale: fr })}
              </p>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <span className="tabular text-title font-semibold">{format(day, "d")}</span>
                {tasks.length > 0 && (
                  <span className={cn("tabular rounded-full px-1.5 text-meta font-semibold", index === 0 ? "bg-bg/15" : "bg-accent-soft text-accent")}>
                    {tasks.length}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex h-1 gap-0.5">
                {tasks.slice(0, 5).map((task) => (
                  <span key={task.id} className="project-swatch flex-1 rounded-full" style={projectSwatchVars(task.project.color)} />
                ))}
              </div>
            </div>
          ))}
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            <Group title="En retard" tone="danger" tasks={overdue} />
            <Group title="Aujourd'hui" tasks={dueToday} />
            <Group title="Cette semaine" tasks={thisWeek} />
            <Group title="Plus tard ou sans échéance" tasks={later} />
            {mine.length === 0 && (
              <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
                <p className="text-title font-semibold tracking-[-0.01em]">Rien ne vous est attribué</p>
                <p className="mx-auto mt-1 max-w-sm text-ui text-muted">
                  {unassignedCount > 0
                    ? "Des tâches attendent un responsable juste en dessous : ouvrez-en une pour vous l'attribuer."
                    : "Tapez C pour créer une tâche, ou ouvrez un projet pour vous en attribuer."}
                </p>
              </div>
            )}
            <Group
              title="À attribuer"
              icon={<UserRoundPlus className="size-3.5" />}
              tasks={unassigned}
              total={unassignedCount}
              hint="Ouvrez une tâche pour choisir qui s'en occupe."
            />
          </div>

          <aside className="space-y-5">
            <Panel icon={<StatusIcon status="WAITING_CLIENT" size={16} />} title="Bloqué côté client" count={waiting.length} empty="Rien n'attend le client.">
              {[...waitingByProject.values()].map((tasks) => (
                <div key={tasks[0].project.slug} className="py-2.5 first:pt-0 last:pb-0">
                  <Link href={`/projects/${tasks[0].project.slug}`} className="flex items-center gap-2 text-ui font-medium hover:underline">
                    <ProjectTile color={tasks[0].project.color} label={tasks[0].project.key} size={16} />
                    {tasks[0].project.name}
                    {tasks.some((task) => differenceInCalendarDays(now, task.statusChangedAt) >= 5) && (
                      <span className="rounded-xs bg-waiting-soft px-1.5 text-meta font-semibold uppercase tracking-wide text-waiting-text">
                        À relancer
                      </span>
                    )}
                    <span className="tabular ml-auto text-meta font-normal text-muted">{tasks.length}</span>
                  </Link>
                  <ul className="mt-1.5 space-y-1 pl-6">
                    {tasks.slice(0, 4).map((task) => (
                      <li key={task.id} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate text-ink-2">{task.title}</span>
                        <AgeChip since={task.statusChangedAt} className="shrink-0" />
                      </li>
                    ))}
                    {tasks.length > 4 && <li className="text-meta text-muted">+ {tasks.length - 4} autres</li>}
                  </ul>
                </div>
              ))}
            </Panel>

            <Panel icon={<StatusIcon status="REVIEW" size={16} />} title="À valider" count={review.length} empty="Rien à valider.">
              <ul className="space-y-1.5">
                {review.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 text-xs">
                    <ProjectTile color={task.project.color} label={task.project.key} size={14} />
                    <span className="min-w-0 flex-1 truncate text-ink-2">{task.title}</span>
                    <span className="font-mono text-meta text-muted">{task.project.key}-{task.number}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel icon={<span className="size-2 rounded-full bg-progress" />} title="Projets actifs" count={activeProjects.length} empty="Aucun projet actif.">
              <ul className="space-y-3">
                {activeProjects.map((project) => {
                  const total = project.tasks.length;
                  const done = project.tasks.filter((task) => task.status === "DONE").length;
                  return (
                    <li key={project.id}>
                      <Link href={`/projects/${project.slug}`} className="group block">
                        <div className="flex items-center gap-2 text-xs">
                          <ProjectTile color={project.color} label={project.key} size={16} />
                          <span className="min-w-0 flex-1 truncate font-medium group-hover:underline">{project.name}</span>
                          <span className="tabular text-muted">{total ? Math.round((done / total) * 100) : 0} %</span>
                        </div>
                        {project.statusNote && <p className="mt-1 line-clamp-2 text-meta leading-snug text-muted">{project.statusNote}</p>}
                        <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-sunken">
                          {TASK_STATUSES.slice()
                            .reverse()
                            .map((status) => {
                              const count = project.tasks.filter((task) => task.status === status.value).length;
                              return count ? <span key={status.value} style={{ flex: count, backgroundColor: status.tone }} /> : null;
                            })}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <Panel icon={<Users className="size-4 text-muted" />} title="Charge de l'équipe" count={teamLoad.length} empty="Aucun membre.">
              <ul className="space-y-2.5">
                {teamLoad.map((member) => (
                  <li key={member.id} className="flex items-center gap-2.5 text-xs">
                    <Avatar name={member.name} color={member.color} size={20} />
                    <span className="w-24 shrink-0 truncate">{member.name.split(" ")[0]}</span>
                    <span className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-sunken">
                      <span className="rounded-full" style={{ width: `${(member.open / maxLoad) * 100}%`, backgroundColor: member.color }} />
                    </span>
                    <span className="tabular w-5 text-right text-muted">{member.open}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel icon={<Rocket className="size-4 text-done-text" />} title="Dernières mises en ligne" count={deliveries.length} empty="Aucune mise en ligne enregistrée.">
              <ol className="space-y-3">
                {deliveries.map((delivery) => (
                  <li key={delivery.id} className="flex gap-2.5">
                    <ProjectTile color={delivery.project.color} label={delivery.project.key} size={16} />
                    <div className="min-w-0 text-xs">
                      <p className="truncate font-medium text-ink">{delivery.title}</p>
                      <Tooltip content={formatDateTime(delivery.deployedAt)}>
                        <p className="text-muted">
                          {delivery.project.name} · {timeAgo(delivery.deployedAt)}
                        </p>
                      </Tooltip>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <span
          className="flex size-6 items-center justify-center rounded-sm"
          style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)` }}
        >
          {icon}
        </span>
        {label}
      </div>
      <p className="tabular mt-3 font-display text-hero font-semibold leading-none tracking-tight">{value}</p>
      <p className="mt-1.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Group({
  title,
  tasks,
  tone,
  icon,
  total,
  hint,
}: {
  title: string;
  tasks: TaskWithProject[];
  tone?: "danger";
  icon?: React.ReactNode;
  total?: number;
  hint?: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <section>
      <h2 className={cn("mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider", tone === "danger" ? "text-danger-text" : "text-muted")}>
        {icon}
        {title}
        <span className="tabular font-normal">{total ?? tasks.length}</span>
        {hint && <span className="ml-1 hidden font-normal normal-case tracking-normal text-muted sm:inline">{hint}</span>}
      </h2>
      <ul className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} projectKey={task.project.key} project={task.project} />
        ))}
      </ul>
      {total !== undefined && total > tasks.length && (
        <p className="mt-1.5 text-xs text-muted">+ {total - tasks.length} autres, à retrouver dans les projets.</p>
      )}
    </section>
  );
}

function Panel({
  icon,
  title,
  count,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-ui font-semibold">
        {icon}
        {title}
        <span className="tabular ml-auto text-xs font-normal text-muted">{count}</span>
      </h2>
      {count === 0 ? <p className="text-xs text-muted">{empty}</p> : <div className="divide-y divide-line">{children}</div>}
    </section>
  );
}
