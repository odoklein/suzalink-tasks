import { tz } from "@date-fns/tz";
import { addDays, differenceInCalendarDays, isSameDay, subDays } from "date-fns";
import { AlarmClock, ArrowRight, CalendarDays, ListChecks, Rocket, Sparkles, UserRoundPlus, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ChaseButton } from "@/components/chase-dialog";
import { NewTaskButton } from "@/components/new-task-button";
import { AgeChip, Avatar, ProjectTile, StatusIcon } from "@/components/primitives";
import { Card, CardHeader } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { TaskRow } from "@/components/task-row";
import { projectSwatchVars } from "@/lib/color";
import { CHASE_AFTER_DAYS, chaseLabel, chaseState, waitingStart } from "@/lib/chasing";
import { getCurrentUser, getTeam } from "@/lib/dal";
import { db } from "@/lib/db";
import { capitalizeFirst, NNBSP } from "@/lib/fr";
import { countReportsToReview } from "@/lib/meetings/queries";
import { plural } from "@/lib/plural";
import { endOfDayParis, formatParis, nowParis, startOfDayParis, TZ } from "@/lib/time";
import { taskCardSelect, type TaskCard } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Aujourd’hui" };

type TaskWithProject = TaskCard & {
  project: { id: string; key: string; name: string; color: string; slug: string; lastChasedAt: Date | null };
};

const withProject = {
  ...taskCardSelect,
  project: { select: { id: true, key: true, name: true, color: true, slug: true, lastChasedAt: true } },
} as const;

/** Au-delà de six parts, l’anneau de charge regroupe le reste dans « Autres ». */
const DONUT_MAX = 6;

export default async function TodayPage() {
  const user = await getCurrentUser();
  // Les serveurs tournent en UTC : « aujourd'hui », « demain » et la semaine suivent le jour calendaire de Paris.
  const inParis = { in: tz(TZ) };
  const now = nowParis();
  const today = startOfDayParis(now);
  const endToday = endOfDayParis(now);
  const endWeek = endOfDayParis(addDays(now, 6));
  const live = { archived: false };

  const [
    mine,
    waiting,
    review,
    deliveries,
    deliveredThisWeek,
    deliveredWeekBefore,
    activeProjects,
    unassigned,
    unassignedCount,
    workload,
    overdueLoad,
    team,
    reportsToReview,
  ] = await Promise.all([
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
      where: { deletedAt: null },
      orderBy: { deployedAt: "desc" },
      take: 5,
      include: { project: { select: { name: true, color: true, key: true, slug: true } } },
    }),
    db.delivery.count({ where: { deletedAt: null, deployedAt: { gte: subDays(today, 6) } } }),
    db.delivery.count({ where: { deletedAt: null, deployedAt: { gte: subDays(today, 13), lt: subDays(today, 6) } } }),
    db.project.findMany({
      where: { ...live, status: { not: "DONE" } },
      orderBy: { updatedAt: "desc" },
      take: 7,
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
    db.task.groupBy({
      by: ["assigneeId"],
      where: { assigneeId: { not: null }, status: { not: "DONE" }, dueDate: { lt: today }, project: live },
      _count: { _all: true },
    }),
    // Déjà chargée (et mise en cache pour la requête) par la mise en page : pas de seconde requête.
    getTeam(),
    countReportsToReview(),
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
  const waitingGroups = [...waitingByProject.values()].map((tasks) => ({
    tasks,
    chase: chaseState(tasks, tasks[0].project.lastChasedAt, now),
  }));
  const toChase = waitingGroups.filter((group) => group.chase.kind === "due").length;

  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(addDays(today, index, inParis).getTime());
    return { day, tasks: mine.filter((task) => task.dueDate && isSameDay(task.dueDate, day, inParis)) };
  });

  const loadByUser = new Map(workload.map((row) => [row.assigneeId, row._count._all]));
  const overdueByUser = new Map(overdueLoad.map((row) => [row.assigneeId, row._count._all]));
  const teamLoad = team
    .map((member) => ({ ...member, open: loadByUser.get(member.id) ?? 0, late: overdueByUser.get(member.id) ?? 0 }))
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
  const openAssigned = teamLoad.reduce((sum, member) => sum + member.open, 0);

  const projectTasks = activeProjects.flatMap((project) => project.tasks);
  const doneTasks = projectTasks.filter((task) => task.status === "DONE").length;

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
  const deliveryDelta = deliveredThisWeek - deliveredWeekBefore;

  return (
    <div className="@container min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[var(--page-wide)] px-4 pb-12 pt-6 sm:px-8 sm:pt-7">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-h1 font-semibold tracking-tight">
              {greeting} {firstName}.
            </h1>
            <p className="mt-0.5 text-body text-muted">
              {summary.length ? `${summary.join(" · ")}.` : `Rien d’urgent${NNBSP}: bonne journée pour avancer.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <p className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-surface px-3 text-ui font-medium text-ink-2 max-sm:hidden">
              <CalendarDays aria-hidden="true" className="size-4 text-muted" />
              {capitalizeFirst(parisDate)}
            </p>
            <NewTaskButton />
          </div>
        </header>

        {reportsToReview > 0 && (
          <Link
            href="/reunions"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-waiting/40 bg-waiting-soft px-3 py-1.5 text-ui font-medium text-waiting-text transition-colors hover:border-waiting pointer-coarse:min-h-11"
          >
            <Video aria-hidden="true" className="size-4" />
            {plural(reportsToReview, "compte rendu de réunion à revoir", "comptes rendus de réunion à revoir")}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        )}

        {/* Chiffres clés */}
        <section aria-label="Chiffres clés" className="mt-6 grid grid-cols-2 gap-3 @min-[640px]:grid-cols-3 @min-[1080px]:grid-cols-5">
          <Stat
            href="#en-retard"
            icon={<AlarmClock />}
            tone={overdue.length ? "danger" : "todo"}
            label="En retard"
            value={overdue.length}
            hint={overdue.length ? "À traiter en premier" : "Rien en retard"}
          />
          <Stat
            href="#aujourdhui"
            icon={<CalendarDays />}
            tone="progress"
            label="Aujourd’hui"
            value={dueToday.length}
            hint={
              <>
                <Emphasis tone="progress">{thisWeek.length}</Emphasis> d’ici 7 jours
              </>
            }
          />
          <Stat
            href="#chez-le-client"
            icon={<StatusIcon status="WAITING_CLIENT" size={20} />}
            tone="waiting"
            label="Chez le client"
            value={waiting.length}
            hint={
              waiting.length ? (
                <>
                  Jusqu’à <Emphasis tone="waiting">{`${oldestWaitingDays}${NNBSP}j`}</Emphasis> d’attente
                </>
              ) : (
                "Rien en attente"
              )
            }
          />
          <Stat
            href="#mises-en-ligne"
            icon={<Rocket />}
            tone="done"
            label="Mises en ligne"
            value={deliveredThisWeek}
            hint={
              deliveryDelta ? (
                <>
                  <Emphasis tone={deliveryDelta < 0 ? "danger" : "done"}>{`${deliveryDelta > 0 ? "+" : "−"}${Math.abs(deliveryDelta)}`}</Emphasis> vs 7{NNBSP}j précédents
                </>
              ) : (
                "7 derniers jours"
              )
            }
          />
          <Stat
            href="#a-attribuer"
            icon={<UserRoundPlus />}
            tone="review"
            label="À attribuer"
            value={unassignedCount}
            hint={unassignedCount ? "Sans responsable" : "Tout est attribué"}
          />
        </section>

        <div className="mt-4 grid gap-4 @min-[1080px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Projets actifs et échéances de la semaine */}
          <Card aria-labelledby="projets-actifs" className="@container/projects flex flex-col">
            <CardHeader
              id="projets-actifs"
              title="Projets actifs"
              count={activeProjects.length}
              action={
                <Link href="/projects" className="inline-flex items-center gap-1 rounded-sm text-ui font-medium text-muted hover:text-ink">
                  Tous les projets <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              }
            />
            <div className="grid flex-1 gap-x-8 gap-y-6 px-5 pb-5 @min-[560px]/projects:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
              {activeProjects.length === 0 ? (
                <p className="text-ui text-muted">Aucun projet actif.</p>
              ) : (
                <ul className="space-y-1">
                  {activeProjects.map((project) => {
                    const total = project.tasks.length;
                    const done = project.tasks.filter((task) => task.status === "DONE").length;
                    const share = total ? Math.round((done / total) * 100) : 0;
                    const row = (
                      <Link
                        href={`/projects/${project.slug}`}
                        className="-mx-2 grid grid-cols-[auto_minmax(0,1fr)_minmax(2.5rem,5rem)_2.75rem] items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2"
                      >
                        <ProjectTile color={project.color} label={project.key} size={24} />
                        <span className="truncate text-ui font-medium">{project.name}</span>
                        <span
                          role="img"
                          aria-label={`${done} sur ${total} faites`}
                          className="flex h-2 overflow-hidden rounded-full bg-sunken"
                        >
                          <span className="project-swatch rounded-full" style={{ ...projectSwatchVars(project.color), width: `${share}%` }} />
                        </span>
                        <span className="tabular text-right text-ui font-semibold">
                          {share}
                          {NNBSP}%
                        </span>
                      </Link>
                    );
                    return (
                      <li key={project.id}>
                        {project.statusNote ? <Tooltip content={project.statusNote}>{row}</Tooltip> : row}
                      </li>
                    );
                  })}
                </ul>
              )}

              <WeekChart week={week} />
            </div>

            <div className="mx-5 mb-5 flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-ui text-muted">
              <span className="inline-flex items-center gap-2">
                <ListChecks aria-hidden="true" className="size-4 text-done" />
                <span>
                  <strong className="font-semibold text-ink">
                    {projectTasks.length ? Math.round((doneTasks / projectTasks.length) * 100) : 0}
                    {NNBSP}%
                  </strong>{" "}
                  ({doneTasks}/{projectTasks.length}) des tâches faites
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                <StatusIcon status="REVIEW" size={16} />
                <span>
                  <strong className="font-semibold text-ink">{review.length}</strong> à valider
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                <StatusIcon status="WAITING_CLIENT" size={16} />
                <span>
                  <strong className="font-semibold text-ink">{toChase}</strong> {toChase > 1 ? "projets" : "projet"} à relancer
                </span>
              </span>
            </div>
          </Card>

          {/* Charge de l’équipe */}
          <Card aria-labelledby="charge-equipe" className="@container/team flex flex-col">
            <CardHeader id="charge-equipe" title="Charge de l’équipe" count={teamLoad.length} />
            {teamLoad.length === 0 ? (
              <p className="px-5 pb-5 text-ui text-muted">Aucun membre.</p>
            ) : (
              <div className="flex flex-1 flex-col items-center gap-5 px-5 pb-5 @min-[420px]/team:flex-row @min-[420px]/team:items-start">
                <Donut
                  total={openAssigned}
                  label={openAssigned > 1 ? "tâches ouvertes" : "tâche ouverte"}
                  segments={foldSegments(teamLoad.filter((member) => member.open > 0))}
                />
                <table className="w-full min-w-0 text-ui">
                  <caption className="sr-only">Tâches ouvertes et en retard par membre</caption>
                  <thead className="text-xs text-muted">
                    <tr>
                      <th scope="col" className="pb-2 text-left font-medium">Membre</th>
                      <th scope="col" className="pb-2 text-right font-medium">En retard</th>
                      <th scope="col" className="pb-2 text-right font-medium">Ouvertes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamLoad.map((member) => (
                      <tr key={member.id}>
                        <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                          <span className="flex min-w-0 items-center gap-2">
                            <Avatar name={member.name} color={member.color} size={24} />
                            <span className="truncate">{member.name.split(" ")[0]}</span>
                          </span>
                        </th>
                        <td className={cn("tabular py-1.5 text-right", member.late ? "font-medium text-danger-text" : "text-muted")}>
                          {member.late || "–"}
                        </td>
                        <td className="tabular py-1.5 text-right">
                          <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: member.color }} />
                            {member.open}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {unassignedCount > 0 && (
              <a
                href="#a-attribuer"
                className="mx-5 mb-5 flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface text-ui font-medium text-ink-2 shadow-xs transition-colors hover:border-line-strong hover:text-ink"
              >
                {plural(unassignedCount, "tâche")} à attribuer <ArrowRight aria-hidden="true" className="size-4" />
              </a>
            )}
          </Card>
        </div>

        {/* Ancre commune : en tête du bandeau (étroit) comme de la carte (large), toujours visible. */}
        <div id="chez-le-client" aria-hidden="true" className="scroll-mt-6" />
        {/* Sous 1080 px de contenu : « Chez le client » d’abord, en bandeau horizontal par projet. */}
        {waiting.length > 0 && (
          <section aria-labelledby="chez-le-client-bandeau" className="mt-6 @min-[1080px]:hidden">
            <h2 id="chez-le-client-bandeau" className="mb-2.5 flex items-center gap-2 text-title font-semibold tracking-title">
              Chez le client <span aria-hidden="true" className="tabular text-ui font-medium text-muted">{waiting.length}</span>
            </h2>
            <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 scroll-thin sm:-mx-8 sm:px-8">
              {waitingGroups.map(({ tasks }) => {
                const oldest = tasks[0];
                return (
                  <li key={oldest.project.slug} className="w-64 shrink-0 snap-start">
                    <Link
                      href={`/projects/${oldest.project.slug}`}
                      className="flex h-full flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5 shadow-card transition-shadow hover:shadow-raised"
                    >
                      <span className="flex items-center gap-2.5 text-ui font-medium">
                        <ProjectTile color={oldest.project.color} label={oldest.project.key} size={24} />
                        <span className="min-w-0 flex-1 truncate">{oldest.project.name}</span>
                        <span className="tabular text-xs text-muted">{tasks.length}</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-ink-2">
                        <AgeChip since={waitingStart(oldest)} className="shrink-0" />
                        <span className="min-w-0 truncate">{oldest.title}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <ChaseInsight count={toChase} className="mt-3" />
          </section>
        )}

        <div className="mt-4 grid items-start gap-4 @min-[1080px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            <Card aria-labelledby="mes-taches">
              <CardHeader id="mes-taches" title="Mes tâches" count={mine.length} />
              {mine.length === 0 ? (
                <div className="border-t border-line px-6 py-10 text-center">
                  <p className="text-title font-semibold tracking-title">Rien ne vous est attribué</p>
                  <p className="mx-auto mt-1 max-w-sm text-ui text-muted">
                    {unassignedCount > 0
                      ? `Des tâches attendent un responsable juste en dessous${NNBSP}: ouvrez-en une pour vous l’attribuer.`
                      : "Appuyez sur C pour créer une tâche, ou ouvrez un projet pour vous en attribuer."}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-b-xl">
                  <Group id="en-retard" title="En retard" tone="danger" tasks={overdue} />
                  <Group id="aujourdhui" title="Aujourd’hui" tasks={dueToday} />
                  <Group title="Cette semaine" tasks={thisWeek} />
                  <Group title="Plus tard ou sans échéance" tasks={later} />
                </div>
              )}
            </Card>

            {unassigned.length > 0 && (
              <Card id="a-attribuer" aria-labelledby="a-attribuer-titre" className="scroll-mt-6">
                <CardHeader
                  id="a-attribuer-titre"
                  icon={<UserRoundPlus aria-hidden="true" className="size-4 text-review" />}
                  title="À attribuer"
                  count={unassignedCount}
                  action={<span className="hidden text-xs text-muted sm:inline">Ouvrez une tâche pour choisir qui s’en occupe.</span>}
                />
                <ul className="overflow-hidden rounded-b-xl border-t border-line">
                  {unassigned.map((task) => (
                    <TaskRow key={task.id} task={task} projectKey={task.project.key} project={task.project} />
                  ))}
                </ul>
                {unassignedCount > unassigned.length && (
                  <p className="border-t border-line px-5 py-2.5 text-xs text-muted">
                    + {plural(unassignedCount - unassigned.length, "autre")}, à retrouver dans les projets.
                  </p>
                )}
              </Card>
            )}
          </div>

          <aside aria-label="À suivre" className="min-w-0 space-y-4">
            {waiting.length > 0 && (
              <Card aria-labelledby="chez-le-client-titre" className="hidden @min-[1080px]:block">
                <CardHeader
                  id="chez-le-client-titre"
                  icon={<StatusIcon status="WAITING_CLIENT" size={16} />}
                  title="Chez le client"
                  count={waiting.length}
                />
                <div className="divide-y divide-line px-5 pb-4">
                  {waitingGroups.map(({ tasks, chase }) => {
                    const chaseText = chaseLabel(chase, now);
                    return (
                      <div key={tasks[0].project.slug} className="py-3 first:pt-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/projects/${tasks[0].project.slug}`}
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-ui font-medium hover:underline"
                          >
                            <ProjectTile color={tasks[0].project.color} label={tasks[0].project.key} size={24} />
                            <span className="truncate">{tasks[0].project.name}</span>
                            {chase.kind === "due" && (
                              <span className="shrink-0 rounded-full bg-waiting-soft px-2 py-0.5 text-meta font-semibold text-waiting-text ring-1 ring-inset ring-waiting/25">
                                À relancer
                              </span>
                            )}
                            <span className="tabular ml-auto text-xs font-normal text-muted">{tasks.length}</span>
                          </Link>
                          <ChaseButton projectId={tasks[0].project.id} projectName={tasks[0].project.name} compact />
                        </div>
                        {chase.kind === "chased" && chaseText && <p className="mt-0.5 pl-[34px] text-xs text-muted">{chaseText}</p>}
                        <ul className="mt-2 space-y-1.5 pl-[34px]">
                          {tasks.slice(0, 4).map((task) => (
                            <li key={task.id} className="flex items-center gap-2 text-xs">
                              <span className="min-w-0 flex-1 truncate text-ink-2">{task.title}</span>
                              <AgeChip since={waitingStart(task)} className="shrink-0" />
                            </li>
                          ))}
                          {tasks.length > 4 && <li className="text-xs text-muted">+ {plural(tasks.length - 4, "autre")}</li>}
                        </ul>
                      </div>
                    );
                  })}
                </div>
                <ChaseInsight count={toChase} className="mx-5 mb-5" />
              </Card>
            )}

            <Card aria-labelledby="a-valider">
              <CardHeader id="a-valider" icon={<StatusIcon status="REVIEW" size={16} />} title="À valider" count={review.length} />
              {review.length === 0 ? (
                <p className="px-5 pb-5 text-ui text-muted">Rien à valider.</p>
              ) : (
                <ul className="space-y-2 px-5 pb-5">
                  {review.map((task) => (
                    <li key={task.id} className="flex items-center gap-2.5 text-ui">
                      <ProjectTile color={task.project.color} label={task.project.key} size={20} />
                      <span className="min-w-0 flex-1 truncate text-ink-2">{task.title}</span>
                      <span className="font-mono text-meta text-muted">
                        {task.project.key}-{task.number}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card id="mises-en-ligne" aria-labelledby="mises-en-ligne-titre" className="scroll-mt-6">
              <CardHeader
                id="mises-en-ligne-titre"
                icon={<Rocket aria-hidden="true" className="size-4 text-done" />}
                title="Dernières mises en ligne"
                count={deliveries.length}
              />
              {deliveries.length === 0 ? (
                <p className="px-5 pb-5 text-ui text-muted">Aucune mise en ligne enregistrée.</p>
              ) : (
                <ol className="px-5 pb-4">
                  {deliveries.map((delivery) => {
                    const sameDay = isSameDay(delivery.deployedAt, now, inParis);
                    const yesterday = isSameDay(delivery.deployedAt, subDays(now, 1), inParis);
                    return (
                      <li key={delivery.id} className="group grid grid-cols-[3.25rem_0.75rem_minmax(0,1fr)] gap-3">
                        <Tooltip content={formatDateTime(delivery.deployedAt)}>
                          <time dateTime={delivery.deployedAt.toISOString()} className="pt-1.5 text-right leading-tight">
                            <span className="tabular block text-ui text-ink-2">{formatParis(delivery.deployedAt, "HH:mm")}</span>
                            <span className="block text-meta text-muted">
                              {sameDay ? "auj." : yesterday ? "hier" : formatParis(delivery.deployedAt, "d MMM")}
                            </span>
                          </time>
                        </Tooltip>
                        <span aria-hidden="true" className="relative flex justify-center">
                          <span className="absolute bottom-0 top-0 w-px bg-line group-first:top-4 group-last:bottom-auto group-last:h-4 group-only:hidden" />
                          <span
                            className="project-swatch relative mt-3 size-2.5 rounded-full ring-4 ring-surface"
                            style={projectSwatchVars(delivery.project.color)}
                          />
                        </span>
                        <div className="flex min-w-0 items-center gap-3 py-2">
                          <ProjectTile color={delivery.project.color} label={delivery.project.key} size={32} />
                          <div className="min-w-0">
                            <p className="truncate text-ui font-medium">{delivery.title}</p>
                            <p className="truncate text-xs text-muted">{delivery.project.name}</p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}

type StatTone = "danger" | "todo" | "progress" | "waiting" | "done" | "review";

// Classes écrites en entier pour que Tailwind les détecte.
const STAT_TILE: Record<StatTone, string> = {
  danger: "bg-danger-soft text-danger ring-danger/25",
  todo: "bg-todo-soft text-todo ring-todo/25",
  progress: "bg-progress-soft text-progress ring-progress/25",
  waiting: "bg-waiting-soft text-waiting ring-waiting/30",
  done: "bg-done-soft text-done ring-done/25",
  review: "bg-review-soft text-review ring-review/25",
};

const EMPHASIS: Record<"danger" | "progress" | "waiting" | "done", string> = {
  danger: "text-danger-text",
  progress: "text-progress-text",
  waiting: "text-waiting-text",
  done: "text-done-text",
};

/** Chiffre mis en avant dans l’indication d’une statistique (« +2 », « 12 j »), en couleur de texte du ton. */
function Emphasis({ tone, children }: { tone: keyof typeof EMPHASIS; children: React.ReactNode }) {
  return <span className={cn("font-semibold", EMPHASIS[tone])}>{children}</span>;
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
  tone: StatTone;
  label: string;
  value: number;
  hint: React.ReactNode;
}) {
  // Téléphone : la pastille passe au-dessus, pour que le libellé ne soit pas tronqué.
  const tile = "flex flex-col items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-card @min-[640px]:flex-row @min-[640px]:gap-3.5";
  const content = (
    <>
      {/* Pastille en relief : liseré du ton à l’extérieur, filet clair à l’intérieur. */}
      <span
        aria-hidden="true"
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-lg border-2 border-[color:var(--tile-edge)] ring-1 [&>svg]:size-5",
          STAT_TILE[tone],
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-h1 font-semibold leading-none tracking-tight">{value}</p>
        <p className="mt-1.5 truncate text-ui font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{hint}</p>
      </div>
    </>
  );
  // Un lien seulement s’il y a quelque chose à atteindre ; sinon une simple tuile, sans survol ni focus.
  return value > 0 ? (
    <a href={href} className={cn(tile, "outline-hidden transition-shadow hover:shadow-raised focus-visible:shadow-[var(--ring)]")}>
      {content}
    </a>
  ) : (
    <div className={tile}>{content}</div>
  );
}

/** Échéances des 7 prochains jours : une colonne par jour, une seule couleur (une seule série). */
function WeekChart({ week }: { week: { day: Date; tasks: TaskWithProject[] }[] }) {
  const max = Math.max(1, ...week.map(({ tasks }) => tasks.length));
  const total = week.reduce((sum, { tasks }) => sum + tasks.length, 0);
  return (
    <figure aria-labelledby="echeances-semaine" className="flex min-w-0 flex-col">
      <figcaption id="echeances-semaine" className="flex items-baseline justify-between gap-2">
        <span className="text-ui font-medium">Mes échéances, 7 jours</span>
        <span className="tabular text-xs text-muted">{plural(total, "tâche")}</span>
      </figcaption>
      <ol className="mt-3 grid h-40 grid-cols-7 items-end gap-1.5 border-b border-line">
        {week.map(({ day, tasks }) => {
          const count = tasks.length;
          const titles = tasks.map((task) => `${task.project.key}-${task.number} ${task.title}`);
          return (
            <li key={day.toISOString()} className="flex h-full flex-col items-center justify-end">
              <span className="sr-only">
                {capitalizeFirst(formatParis(day, "EEEE d MMMM"))}
                {NNBSP}: {plural(count, "échéance")}
              </span>
              <Tooltip content={titles.length ? titles.slice(0, 6).join(" · ") + (titles.length > 6 ? " …" : "") : "Aucune échéance"}>
                <span aria-hidden="true" className="flex h-full w-full flex-col items-center justify-end gap-1">
                  {count > 0 && <span className="tabular text-xs font-medium text-ink-2">{count}</span>}
                  <span
                    className={cn("w-full max-w-6 rounded-t-xs", count ? "bg-accent" : "h-0.5 bg-line-strong")}
                    style={count ? { height: `${Math.max(8, (count / max) * 100)}%` } : undefined}
                  />
                </span>
              </Tooltip>
            </li>
          );
        })}
      </ol>
      <div aria-hidden="true" className="mt-2 grid grid-cols-7 gap-1.5 text-center text-meta">
        {week.map(({ day }, index) => (
          <span key={day.toISOString()} className={cn("leading-tight", index === 0 ? "font-semibold text-ink" : "text-muted")}>
            <span className="block">{index === 0 ? "Auj." : capitalizeFirst(formatParis(day, "EEE"))}</span>
            <span className="tabular block">{formatParis(day, "d")}</span>
          </span>
        ))}
      </div>
    </figure>
  );
}

type Segment = { id: string; name: string; color: string; value: number };

/** Six parts au plus : au-delà, le reste devient « Autres » (gris), la couleur suit toujours la personne. */
function foldSegments(members: { id: string; name: string; color: string; open: number }[]): Segment[] {
  const segments = members.map((member) => ({ id: member.id, name: member.name, color: member.color, value: member.open }));
  if (segments.length <= DONUT_MAX) return segments;
  const rest = segments.slice(DONUT_MAX - 1);
  return [
    ...segments.slice(0, DONUT_MAX - 1),
    { id: "autres", name: "Autres", color: "var(--todo)", value: rest.reduce((sum, item) => sum + item.value, 0) },
  ];
}

/** Anneau de répartition : fines parts séparées par 2 px de surface, total au centre. */
function Donut({ segments, total, label }: { segments: Segment[]; total: number; label: string }) {
  const size = 120;
  const stroke = 11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = segments.length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <div className="relative grid size-[120px] shrink-0 place-items-center">
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--sunken)" strokeWidth={stroke} />
        {total > 0 &&
          segments.map((segment) => {
            const length = (segment.value / total) * circumference;
            const dash = Math.max(length - gap, 0.5);
            const circle = (
              <circle
                key={segment.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              >
                <title>{`${segment.name} : ${plural(segment.value, "tâche")}`}</title>
              </circle>
            );
            offset += length;
            return circle;
          })}
      </svg>
      <p className="relative text-center leading-tight">
        <span className="block text-h2 font-semibold tracking-tight">{total}</span>
        <span className="mx-auto block max-w-[4.5rem] text-xs text-muted">{label}</span>
      </p>
    </div>
  );
}

/** Bandeau d’alerte : des projets attendent une relance (le client bloque depuis 5 jours ou plus). */
function ChaseInsight({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-ui", className)}>
      <Sparkles aria-hidden="true" className="size-4 shrink-0 text-accent" />
      <span className="font-medium">{plural(count, "projet")} à relancer</span>
      <span className="text-muted">
        le client bloque depuis {CHASE_AFTER_DAYS}
        {NNBSP}jours ou plus
      </span>
    </p>
  );
}

/** Sous-groupe de « Mes tâches » : bandeau de titre puis lignes. */
function Group({ id, title, tasks, tone }: { id?: string; title: string; tasks: TaskWithProject[]; tone?: "danger" }) {
  if (tasks.length === 0) return null;
  return (
    <section id={id} aria-labelledby={id && `${id}-titre`} className="scroll-mt-6">
      <h3
        id={id && `${id}-titre`}
        className={cn(
          "flex items-center gap-2 border-y border-line bg-surface-2 px-4 py-1.5 text-xs font-medium",
          tone === "danger" ? "text-danger-text" : "text-muted",
        )}
      >
        {title}
        <span aria-hidden="true" className="tabular font-normal text-muted">
          {tasks.length}
        </span>
      </h3>
      <ul>
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} projectKey={task.project.key} project={task.project} />
        ))}
      </ul>
    </section>
  );
}
