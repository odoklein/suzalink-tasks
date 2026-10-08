import { tz } from "@date-fns/tz";
import { addDays, differenceInCalendarDays, isSameDay } from "date-fns";
import { AlarmClock, CalendarDays, Rocket, UserRoundPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NewTaskButton } from "@/components/new-task-button";
import { AgeChip, Avatar, ProjectTile, StatusIcon } from "@/components/primitives";
import { SectionHeader } from "@/components/ui/section-header";
import { Tooltip } from "@/components/ui/tooltip";
import { TaskRow } from "@/components/task-row";
import { projectSwatchVars } from "@/lib/color";
import { TASK_STATUSES } from "@/lib/constants";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { capitalizeFirst, NNBSP } from "@/lib/fr";
import { plural } from "@/lib/plural";
import { endOfDayParis, formatParis, nowParis, startOfDayParis, TZ } from "@/lib/time";
import { taskCardSelect, type TaskCard } from "@/lib/types";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Aujourd’hui" };

type TaskWithProject = TaskCard & { project: { key: string; name: string; color: string; slug: string } };

const withProject = {
  ...taskCardSelect,
  project: { select: { key: true, name: true, color: true, slug: true } },
} as const;

export default async function TodayPage() {
  const user = await getCurrentUser();
  // Les serveurs tournent en UTC : « aujourd'hui », « demain » et la semaine suivent le jour calendaire de Paris.
  const inParis = { in: tz(TZ) };
  const now = nowParis();
  const today = startOfDayParis(now);
  const endToday = endOfDayParis(now);
  const endWeek = endOfDayParis(addDays(now, 6));
  const live = { archived: false };

  const [mine, waiting, review, deliveries, activeProjects, unassigned, unassignedCount, workload, team] = await Promise.all([
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
    const day = new Date(addDays(today, index, inParis).getTime());
    return { day, tasks: mine.filter((task) => task.dueDate && isSameDay(task.dueDate, day, inParis)) };
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
    dueToday.length && `${dueToday.length} pour aujourd’hui`,
    waiting.length && `${waiting.length} chez le client`,
    unassignedCount && `${unassignedCount} à attribuer`,
  ].filter(Boolean);

  return (
    <div className="@container min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[var(--page-wide)] px-4 pb-12 pt-6 sm:px-8 sm:pt-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-ui font-medium text-muted">{capitalizeFirst(parisDate)}</p>
            <h1 className="mt-1 font-display text-hero font-semibold leading-tight tracking-tight">
              {greeting} {firstName}
            </h1>
            <p className="mt-1 text-body text-ink-2">
              {summary.length ? `${summary.join(" · ")}.` : `Rien d’urgent${NNBSP}: bonne journée pour avancer.`}
            </p>
          </div>
          <NewTaskButton />
        </header>

        {/* Chiffres clés */}
        <section aria-label="Chiffres clés" className="mt-7 grid grid-cols-2 gap-3 @min-[720px]:grid-cols-4">
          <Stat
            href="#en-retard"
            icon={<AlarmClock className="size-4" />}
            tone={overdue.length ? "var(--danger)" : "var(--todo)"}
            label="En retard"
            value={overdue.length}
            hint={overdue.length ? "À traiter en premier" : "Rien en retard"}
          />
          <Stat
            href="#aujourdhui"
            icon={<CalendarDays className="size-4" />}
            tone="var(--progress)"
            label="Aujourd’hui"
            value={dueToday.length}
            hint={`${thisWeek.length} d’ici 7 jours`}
          />
          <Stat
            href="#chez-le-client"
            icon={<StatusIcon status="WAITING_CLIENT" size={16} />}
            tone="var(--waiting)"
            label="Chez le client"
            value={waiting.length}
            hint={waiting.length ? `La plus ancienne${NNBSP}: ${oldestWaitingDays} j` : "Rien en attente"}
          />
          <Stat
            href="#a-attribuer"
            icon={<UserRoundPlus className="size-4" />}
            tone="var(--review)"
            label="À attribuer"
            value={unassignedCount}
            hint={unassignedCount ? "Sans responsable" : "Tout est attribué"}
          />
        </section>

        {/* Les 7 prochains jours */}
        <section aria-label="Les 7 prochains jours" className="mt-3 grid grid-cols-7 gap-1.5 rounded-lg border border-line bg-surface p-1.5 shadow-card">
          {week.map(({ day, tasks }, index) => (
            <div
              key={day.toISOString()}
              title={tasks.map((task) => `${task.project.key}-${task.number} ${task.title}`).join("\n") || "Aucune échéance"}
              className={cn("rounded-md px-1.5 py-2 sm:px-2.5", index === 0
                  ? "bg-ink text-bg dark:bg-accent-soft dark:text-accent dark:ring-1 dark:ring-accent/30"
                  : "hover:bg-surface-2")}
            >
              <p className={cn("text-meta font-medium capitalize", index === 0 ? "text-bg/70 dark:text-accent" : "text-muted")}>
                <span className="max-sm:hidden">{index === 0 ? "Auj." : capitalizeFirst(formatParis(day, "EEE"))}</span>
                <span className="sm:hidden">{capitalizeFirst(formatParis(day, "EEEEE"))}</span>
              </p>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <span className="tabular text-title font-semibold">{formatParis(day, "d")}</span>
                {tasks.length > 0 && (
                  <span className={cn("tabular rounded-full px-1.5 text-meta font-semibold max-sm:hidden", index === 0 ? "bg-bg/15" : "bg-accent-soft text-accent")}>
                    {tasks.length}
                  </span>
                )}
              </div>
              {/* Téléphone : un point par tâche (5 au plus) */}
              <div className="mt-1 flex gap-0.5 sm:hidden" aria-hidden="true">
                {tasks.slice(0, 5).map((task) => (
                  <span key={task.id} className="project-swatch size-1.5 rounded-full" style={projectSwatchVars(task.project.color)} />
                ))}
              </div>
              <div className="mt-1.5 flex h-1 gap-0.5 max-sm:hidden">
                {tasks.slice(0, 5).map((task) => (
                  <span key={task.id} className="project-swatch flex-1 rounded-full" style={projectSwatchVars(task.project.color)} />
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Ancre commune : en tête du bandeau (étroit) comme du rail (large), toujours visible. */}
        <div id="chez-le-client" aria-hidden="true" className="scroll-mt-6" />
        {/* Sous 1000 px de contenu : « Chez le client » d’abord, en bandeau horizontal par projet. */}
        {waiting.length > 0 && (
          <section aria-labelledby="chez-le-client-bandeau" className="mt-8 @min-[1000px]:hidden">
            <SectionHeader id="chez-le-client-bandeau" title="Chez le client" count={waiting.length} />
            <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 scroll-thin sm:-mx-8 sm:px-8">
              {[...waitingByProject.values()].map((tasks) => {
                const oldest = tasks[0];
                return (
                  <li key={oldest.project.slug} className="w-60 shrink-0 snap-start">
                    <Link
                      href={`/projects/${oldest.project.slug}`}
                      className="flex h-full flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-card transition-shadow hover:shadow-raised"
                    >
                      <span className="flex items-center gap-2 text-ui font-medium">
                        <ProjectTile color={oldest.project.color} label={oldest.project.key} size={16} />
                        <span className="min-w-0 flex-1 truncate">{oldest.project.name}</span>
                        <span className="tabular text-xs text-muted">{tasks.length}</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-ink-2">
                        <AgeChip since={oldest.statusChangedAt} className="shrink-0" />
                        <span className="min-w-0 truncate">{oldest.title}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="mt-8 grid gap-8 @min-[1000px]:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            <Group id="en-retard" title="En retard" tone="danger" tasks={overdue} />
            <Group id="aujourdhui" title="Aujourd’hui" tasks={dueToday} />
            <Group title="Cette semaine" tasks={thisWeek} />
            <Group title="Plus tard ou sans échéance" tasks={later} />
            {mine.length === 0 && (
              <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
                <p className="text-title font-semibold tracking-[-0.01em]">Rien ne vous est attribué</p>
                <p className="mx-auto mt-1 max-w-sm text-ui text-muted">
                  {unassignedCount > 0
                    ? `Des tâches attendent un responsable juste en dessous${NNBSP}: ouvrez-en une pour vous l’attribuer.`
                    : "Appuyez sur C pour créer une tâche, ou ouvrez un projet pour vous en attribuer."}
                </p>
              </div>
            )}
            <Group
              id="a-attribuer"
              title="À attribuer"
              icon={<UserRoundPlus className="size-3.5" />}
              tasks={unassigned}
              total={unassignedCount}
              hint="Ouvrez une tâche pour choisir qui s’en occupe."
            />
          </div>

          <aside className="space-y-5">
            <Panel
              className="hidden @min-[1000px]:block"
              icon={<StatusIcon status="WAITING_CLIENT" size={14} />}
              title="Chez le client"
              count={waiting.length}
              empty="Rien n’attend le client."
            >
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
                    {tasks.length > 4 && <li className="text-meta text-muted">+ {plural(tasks.length - 4, "autre")}</li>}
                  </ul>
                </div>
              ))}
            </Panel>

            <Panel icon={<StatusIcon status="REVIEW" size={14} />} title="À valider" count={review.length} empty="Rien à valider.">
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
                        </div>
                        {project.statusNote && <p className="mt-1 line-clamp-2 text-meta leading-snug text-muted">{project.statusNote}</p>}
                        <div role="img" aria-label={`${done} sur ${total} faites`} className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-sunken">
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
  href,
  icon,
  tone,
  label,
  value,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <a
      href={value > 0 ? href : undefined}
      className="block rounded-lg border border-line bg-surface p-4 shadow-card outline-hidden transition-shadow hover:shadow-raised focus-visible:shadow-[var(--ring)] [&:not([href])]:pointer-events-none"
    >
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
    </a>
  );
}

function Group({
  id,
  title,
  tasks,
  tone,
  icon,
  total,
  hint,
}: {
  id?: string;
  title: string;
  tasks: TaskWithProject[];
  tone?: "danger";
  icon?: React.ReactNode;
  total?: number;
  hint?: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <section id={id} aria-labelledby={id && `${id}-titre`} className="scroll-mt-6">
      <SectionHeader
        id={id && `${id}-titre`}
        icon={icon}
        title={title}
        tone={tone}
        count={total ?? tasks.length}
        action={hint && <span className="hidden text-xs text-muted sm:inline">{hint}</span>}
      />
      <ul className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} projectKey={task.project.key} project={task.project} />
        ))}
      </ul>
      {total !== undefined && total > tasks.length && (
        <p className="mt-1.5 text-xs text-muted">+ {plural(total - tasks.length, "autre")}, à retrouver dans les projets.</p>
      )}
    </section>
  );
}

function Panel({
  id,
  className,
  icon,
  title,
  count,
  empty,
  children,
}: {
  id?: string;
  className?: string;
  icon: React.ReactNode;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-6 rounded-lg border border-line bg-surface p-4 shadow-card", className)}>
      <SectionHeader icon={icon} title={title} count={count} className="mb-3" />
      {count === 0 ? <p className="text-xs text-muted">{empty}</p> : <div className="divide-y divide-line">{children}</div>}
    </section>
  );
}
