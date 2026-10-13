import { addDays, isSameDay, subDays } from "date-fns";
import { tz } from "@date-fns/tz";
import { ArrowRight, Mail, Rocket, UserRoundPlus, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ChaseButton } from "@/components/chase-dialog";
import { NewTaskButton } from "@/components/new-task-button";
import { Avatar, ProjectTile, StatusIcon } from "@/components/primitives";
import { Card, CardHeader } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { TaskRow } from "@/components/task-row";
import { projectSwatchVars } from "@/lib/color";
import { chaseLabel, chaseState } from "@/lib/chasing";
import { type CurrentUser, getCurrentUser, getTeam } from "@/lib/dal";
import { db } from "@/lib/db";
import { capitalizeFirst, NNBSP } from "@/lib/fr";
import { countEmailsToReview, countReportsToReview } from "@/lib/meetings/queries";
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

const live = { archived: false };

/** Tâches en retard montrées d’emblée ; les suivantes se déplient. */
const OVERDUE_SHOWN = 5;

/** Regroupe les tâches « chez le client » par projet, avec l’état de relance de chacun. */
function groupWaiting(waiting: TaskWithProject[], now: Date) {
  const byProject = new Map<string, TaskWithProject[]>();
  for (const task of waiting) byProject.set(task.project.slug, [...(byProject.get(task.project.slug) ?? []), task]);
  return [...byProject.values()].map((tasks) => ({ tasks, project: tasks[0].project, chase: chaseState(tasks, tasks[0].project.lastChasedAt, now) }));
}

/**
 * Aujourd’hui, en deux vues : « Pour moi » (par défaut) ne montre que ce qui demande une action
 * maintenant ; « Équipe » regroupe le suivi collectif (attribution, client, validation, charge).
 */
export default async function TodayPage(props: PageProps<"/">) {
  const user = await getCurrentUser();
  const view = (await props.searchParams).vue === "equipe" ? "equipe" : "moi";
  const now = nowParis();

  // Les serveurs tournent en UTC : l'heure et la date affichées suivent Paris.
  const parisHour = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: TZ }).format(now));
  const parisDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(now);
  const greeting = parisHour < 12 ? "Bonjour" : parisHour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-8 sm:pt-8">
        <header className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-ui text-muted">{capitalizeFirst(parisDate)}</p>
            <h1 className="text-h1 font-semibold tracking-tight">
              {greeting} {user.name.split(" ")[0]}.
            </h1>
          </div>
          <NewTaskButton />
        </header>

        <nav aria-label="Vue" className="mt-5 flex gap-5 border-b border-line">
          <ViewLink href="/" active={view === "moi"}>
            Pour moi
          </ViewLink>
          <ViewLink href="/?vue=equipe" active={view === "equipe"}>
            Équipe
          </ViewLink>
        </nav>

        {view === "moi" ? <MyDay user={user} now={now} /> : <TeamView now={now} />}
      </div>
    </div>
  );
}

function ViewLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "-mb-px border-b-2 py-2.5 text-ui font-medium transition-colors pointer-coarse:min-h-11",
        active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

/* ───────────────────────────── Pour moi ───────────────────────────── */

async function MyDay({ user, now }: { user: CurrentUser; now: Date }) {
  const today = startOfDayParis(now);
  const endToday = endOfDayParis(now);
  const endWeek = endOfDayParis(addDays(now, 6));

  const [mine, waiting, reportsToReview, emailsToReview] = await Promise.all([
    db.task.findMany({
      where: { assigneeId: user.id, status: { notIn: ["DONE", "WAITING_CLIENT"] }, project: live },
      select: withProject,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { updatedAt: "desc" }],
    }),
    db.task.findMany({
      where: { status: "WAITING_CLIENT", project: live },
      select: withProject,
      orderBy: { statusChangedAt: "asc" },
    }),
    countReportsToReview(),
    countEmailsToReview(),
  ]);

  const overdue = mine.filter((task) => task.dueDate && task.dueDate < today);
  const dueToday = mine.filter((task) => task.dueDate && task.dueDate >= today && task.dueDate <= endToday);
  const thisWeek = mine.filter((task) => task.dueDate && task.dueDate > endToday && task.dueDate <= endWeek);
  const later = mine.filter((task) => !task.dueDate || task.dueDate > endWeek);
  const toChase = groupWaiting(waiting, now).filter((group) => group.chase.kind === "due");

  const urgent = overdue.length + dueToday.length + toChase.length + (reportsToReview > 0 ? 1 : 0) + (emailsToReview > 0 ? 1 : 0);

  return (
    <div className="mt-6 space-y-8">
      <section aria-labelledby="en-premier">
        <h2 id="en-premier" className="text-title font-semibold tracking-title">
          À faire en premier
        </h2>
        <p className="mt-0.5 text-ui text-muted">
          {urgent
            ? [
                overdue.length && `${overdue.length} en retard`,
                dueToday.length && `${dueToday.length} pour aujourd’hui`,
                toChase.length && plural(toChase.length, "client à relancer", "clients à relancer"),
              ]
                .filter(Boolean)
                .join(" · ") || "À revoir avant de commencer"
            : `Rien d’urgent${NNBSP}: bonne journée pour avancer.`}
        </p>

        {urgent > 0 && (
          <Card className="mt-3 overflow-hidden">
            {(reportsToReview > 0 || emailsToReview > 0) && (
              <ul className="divide-y divide-line border-b border-line">
                {reportsToReview > 0 && (
                  <AlertRow href="/reunions" icon={<Video className="size-4" />}>
                    {plural(reportsToReview, "compte rendu de réunion à revoir", "comptes rendus de réunion à revoir")}
                  </AlertRow>
                )}
                {emailsToReview > 0 && (
                  <AlertRow href="/courriels" icon={<Mail className="size-4" />}>
                    {plural(emailsToReview, "e-mail client à revoir", "e-mails clients à revoir")}
                  </AlertRow>
                )}
              </ul>
            )}

            {toChase.length > 0 && (
              <ul className="divide-y divide-line">
                {toChase.map(({ project, tasks, chase }) => (
                  <li key={project.id} className="flex items-center gap-3 px-4 py-2.5">
                    <ProjectTile color={project.color} label={project.key} size={20} />
                    <Link href={`/projects/${project.slug}`} className="min-w-0 flex-1 truncate text-ui hover:underline">
                      Relancer <span className="font-medium">{project.name}</span>
                      <span className="ml-2 text-xs text-muted">
                        {plural(tasks.length, "élément")} en attente
                        {chase.kind === "due" && ` depuis ${chase.oldestDays}${NNBSP}j`}
                      </span>
                    </Link>
                    <ChaseButton projectId={project.id} projectName={project.name} compact />
                  </li>
                ))}
              </ul>
            )}

            <TaskGroup title="En retard" tone="danger" tasks={overdue} limit={OVERDUE_SHOWN} />
            <TaskGroup title="Aujourd’hui" tasks={dueToday} />
          </Card>
        )}
      </section>

      {thisWeek.length + later.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-title font-semibold tracking-title [&::-webkit-details-marker]:hidden">
            Ensuite
            <span className="tabular text-ui font-medium text-muted">{thisWeek.length + later.length}</span>
            <span className="ml-auto text-ui font-normal text-muted group-open:hidden">Afficher</span>
            <span className="ml-auto hidden text-ui font-normal text-muted group-open:inline">Masquer</span>
          </summary>
          <Card className="mt-3 overflow-hidden">
            <TaskGroup title="Cette semaine" tasks={thisWeek} />
            <TaskGroup title="Plus tard ou sans échéance" tasks={later} />
          </Card>
        </details>
      )}

      {mine.length === 0 && (
        <p className="text-ui text-muted">
          Aucune tâche ouverte pour vous.{" "}
          <Link href="/?vue=equipe" className="font-medium text-ink underline-offset-2 hover:underline">
            Voir les tâches à attribuer
          </Link>
        </p>
      )}
    </div>
  );
}

function AlertRow({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 bg-waiting-soft/50 px-4 py-2.5 text-ui font-medium text-waiting-text transition-colors hover:bg-waiting-soft">
        <span aria-hidden="true">{icon}</span>
        <span className="flex-1">{children}</span>
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </li>
  );
}

/** Groupe de tâches : petit bandeau de titre puis lignes allégées ; au-delà de `limit`, le reste se déplie. */
function TaskGroup({ title, tasks, tone, limit }: { title: string; tasks: TaskWithProject[]; tone?: "danger"; limit?: number }) {
  if (tasks.length === 0) return null;
  const shown = limit ? tasks.slice(0, limit) : tasks;
  const hidden = limit ? tasks.slice(limit) : [];
  const row = (task: TaskWithProject) => <TaskRow key={task.id} task={task} projectKey={task.project.key} project={task.project} compact />;
  return (
    <section aria-label={title} className="border-t border-line first:border-t-0">
      <h3 className={cn("flex items-center gap-2 bg-surface-2 px-4 py-1.5 text-xs font-medium", tone === "danger" ? "text-danger-text" : "text-muted")}>
        {title}
        <span aria-hidden="true" className="tabular font-normal text-muted">
          {tasks.length}
        </span>
      </h3>
      <ul className="border-t border-line">{shown.map(row)}</ul>
      {hidden.length > 0 && (
        <details className="border-t border-line">
          <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted hover:text-ink">Voir les {hidden.length} autres</summary>
          <ul className="border-t border-line">{hidden.map(row)}</ul>
        </details>
      )}
    </section>
  );
}

/* ────────────────────────────── Équipe ────────────────────────────── */

async function TeamView({ now }: { now: Date }) {
  const today = startOfDayParis(now);
  const inParis = { in: tz(TZ) };

  const [unassigned, unassignedCount, waiting, review, activeProjects, workload, overdueLoad, team, deliveries] = await Promise.all([
    db.task.findMany({
      where: { assigneeId: null, status: { notIn: ["DONE", "WAITING_CLIENT"] }, project: live },
      select: withProject,
      orderBy: [{ priority: "desc" }, { dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 8,
    }),
    db.task.count({ where: { assigneeId: null, status: { notIn: ["DONE", "WAITING_CLIENT"] }, project: live } }),
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
    db.project.findMany({
      where: { ...live, status: { not: "DONE" } },
      orderBy: { updatedAt: "desc" },
      take: 7,
      select: { id: true, name: true, slug: true, key: true, color: true, statusNote: true, tasks: { select: { status: true } } },
    }),
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
    db.delivery.findMany({
      where: { deletedAt: null },
      orderBy: { deployedAt: "desc" },
      take: 5,
      include: { project: { select: { name: true, color: true, key: true, slug: true } } },
    }),
  ]);

  const waitingGroups = groupWaiting(waiting, now);
  const loadByUser = new Map(workload.map((row) => [row.assigneeId, row._count._all]));
  const overdueByUser = new Map(overdueLoad.map((row) => [row.assigneeId, row._count._all]));
  const teamLoad = team
    .map((member) => ({ ...member, open: loadByUser.get(member.id) ?? 0, late: overdueByUser.get(member.id) ?? 0 }))
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));

  return (
    <div className="mt-6 space-y-4">
      {unassigned.length > 0 && (
        <Card aria-labelledby="a-attribuer" className="overflow-hidden">
          <CardHeader
            id="a-attribuer"
            icon={<UserRoundPlus aria-hidden="true" className="size-4 text-review" />}
            title="À attribuer"
            count={unassignedCount}
            action={<span className="hidden text-xs text-muted sm:inline">Ouvrez une tâche pour choisir qui s’en occupe.</span>}
          />
          <ul className="border-t border-line">
            {unassigned.map((task) => (
              <TaskRow key={task.id} task={task} projectKey={task.project.key} project={task.project} compact />
            ))}
          </ul>
          {unassignedCount > unassigned.length && (
            <p className="border-t border-line px-5 py-2.5 text-xs text-muted">+ {plural(unassignedCount - unassigned.length, "autre")}, à retrouver dans les projets.</p>
          )}
        </Card>
      )}

      {waitingGroups.length > 0 && (
        <Card aria-labelledby="chez-le-client">
          <CardHeader id="chez-le-client" icon={<StatusIcon status="WAITING_CLIENT" size={16} />} title="Chez le client" count={waiting.length} />
          <ul className="divide-y divide-line px-5 pb-3">
            {waitingGroups.map(({ project, tasks, chase }) => {
              const chaseText = chase.kind === "chased" ? chaseLabel(chase, now) : null;
              return (
                <li key={project.id} className="flex items-center gap-2.5 py-2.5 first:pt-0">
                  <ProjectTile color={project.color} label={project.key} size={20} />
                  <Link href={`/projects/${project.slug}`} className="min-w-0 flex-1 truncate text-ui hover:underline">
                    {project.name}
                    {chaseText && <span className="ml-2 text-xs text-muted">{chaseText}</span>}
                  </Link>
                  {chase.kind === "due" && (
                    <span className="shrink-0 rounded-full bg-waiting-soft px-2 py-0.5 text-meta font-semibold text-waiting-text ring-1 ring-inset ring-waiting/25">
                      À relancer
                    </span>
                  )}
                  <span className="tabular text-xs text-muted">{tasks.length}</span>
                  <ChaseButton projectId={project.id} projectName={project.name} compact />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {review.length > 0 && (
        <Card aria-labelledby="a-valider" className="overflow-hidden">
          <CardHeader id="a-valider" icon={<StatusIcon status="REVIEW" size={16} />} title="À valider" count={review.length} />
          <ul className="border-t border-line">
            {review.map((task) => (
              <TaskRow key={task.id} task={task} projectKey={task.project.key} project={task.project} compact />
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card aria-labelledby="charge-equipe">
          <CardHeader id="charge-equipe" title="Charge de l’équipe" />
          <table className="mx-5 mb-4 w-[calc(100%-2.5rem)] text-ui">
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
                      <Avatar name={member.name} color={member.color} size={22} />
                      <span className="truncate">{member.name.split(" ")[0]}</span>
                    </span>
                  </th>
                  <td className={cn("tabular py-1.5 text-right", member.late ? "font-medium text-danger-text" : "text-muted")}>{member.late || "–"}</td>
                  <td className="tabular py-1.5 text-right">{member.open}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card aria-labelledby="projets-actifs">
          <CardHeader
            id="projets-actifs"
            title="Projets actifs"
            action={
              <Link href="/projects" className="inline-flex items-center gap-1 rounded-sm text-ui font-medium text-muted hover:text-ink">
                Tous <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            }
          />
          <ul className="space-y-0.5 px-3 pb-4">
            {activeProjects.map((project) => {
              const total = project.tasks.length;
              const done = project.tasks.filter((task) => task.status === "DONE").length;
              const share = total ? Math.round((done / total) * 100) : 0;
              const row = (
                <Link
                  href={`/projects/${project.slug}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_2.75rem] items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2"
                >
                  <ProjectTile color={project.color} label={project.key} size={20} />
                  <span className="truncate text-ui">{project.name}</span>
                  <span className="tabular text-right text-xs text-muted" aria-label={`${done} sur ${total} faites`}>
                    {share}
                    {NNBSP}%
                  </span>
                </Link>
              );
              return <li key={project.id}>{project.statusNote ? <Tooltip content={project.statusNote}>{row}</Tooltip> : row}</li>;
            })}
          </ul>
        </Card>
      </div>

      {deliveries.length > 0 && (
        <Card aria-labelledby="mises-en-ligne">
          <CardHeader id="mises-en-ligne" icon={<Rocket aria-hidden="true" className="size-4 text-done" />} title="Dernières mises en ligne" />
          <ul className="divide-y divide-line px-5 pb-3">
            {deliveries.map((delivery) => {
              const when = isSameDay(delivery.deployedAt, now, inParis)
                ? "auj."
                : isSameDay(delivery.deployedAt, subDays(now, 1), inParis)
                  ? "hier"
                  : formatParis(delivery.deployedAt, "d MMM");
              return (
                <li key={delivery.id} className="flex items-center gap-2.5 py-2 first:pt-0">
                  <span aria-hidden="true" className="project-swatch size-2 shrink-0 rounded-full" style={projectSwatchVars(delivery.project.color)} />
                  <Link href={`/projects/${delivery.project.slug}?vue=mises-en-ligne`} className="min-w-0 flex-1 truncate text-ui hover:underline">
                    {delivery.title}
                    <span className="ml-2 text-xs text-muted">{delivery.project.name}</span>
                  </Link>
                  <Tooltip content={formatDateTime(delivery.deployedAt)}>
                    <time dateTime={delivery.deployedAt.toISOString()} className="tabular shrink-0 text-xs text-muted">
                      {when} {formatParis(delivery.deployedAt, "HH:mm")}
                    </time>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
