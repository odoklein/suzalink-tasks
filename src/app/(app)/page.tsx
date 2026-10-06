import { addDays, differenceInCalendarDays, endOfDay, format, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Hourglass, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ProjectTile, StatusIcon } from "@/components/primitives";
import { TaskRow } from "@/components/task-row";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { taskCardSelect, type TaskCard } from "@/lib/types";
import { formatDateTime, timeAgo } from "@/lib/utils";

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
  const endWeek = endOfDay(addDays(now, 7));
  const liveProject = { archived: false };

  const [mine, waiting, review, deliveries] = await Promise.all([
    db.task.findMany({
      where: { assigneeId: user.id, status: { not: "DONE" }, project: liveProject },
      select: withProject,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }, { updatedAt: "desc" }],
    }),
    db.task.findMany({
      where: { status: "WAITING_CLIENT", project: liveProject },
      select: withProject,
      orderBy: { updatedAt: "asc" },
    }),
    db.task.findMany({
      where: { status: "REVIEW", project: liveProject },
      select: withProject,
      orderBy: { updatedAt: "asc" },
      take: 8,
    }),
    db.delivery.findMany({
      orderBy: { deployedAt: "desc" },
      take: 5,
      include: { project: { select: { name: true, color: true, key: true, slug: true } }, author: { select: { name: true } } },
    }),
  ]);

  const overdue = mine.filter((task) => task.dueDate && task.dueDate < today);
  const dueToday = mine.filter((task) => task.dueDate && task.dueDate >= today && task.dueDate <= endToday);
  const thisWeek = mine.filter((task) => task.dueDate && task.dueDate > endToday && task.dueDate <= endWeek);
  const later = mine.filter((task) => !task.dueDate || task.dueDate > endWeek);

  const waitingByProject = new Map<string, TaskWithProject[]>();
  for (const task of waiting) {
    waitingByProject.set(task.project.slug, [...(waitingByProject.get(task.project.slug) ?? []), task]);
  }

  const firstName = user.name.split(" ")[0];
  const summary = [
    overdue.length && `${overdue.length} en retard`,
    dueToday.length && `${dueToday.length} pour aujourd'hui`,
    waiting.length && `${waiting.length} bloquées côté client`,
  ].filter(Boolean);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-8 py-8 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <p className="text-[13px] font-medium capitalize text-muted">{format(now, "EEEE d MMMM", { locale: fr })}</p>
          <h1 className="mt-1 font-display text-[30px] font-semibold tracking-tight">Bonjour {firstName}</h1>
          <p className="mt-1 text-[14px] text-ink-2">
            {summary.length ? `${summary.join(" · ")}.` : "Rien d'urgent : bonne journée pour avancer."}
          </p>

          <div className="mt-7 space-y-6">
            <Group title="En retard" tone="danger" tasks={overdue} />
            <Group title="Aujourd'hui" tasks={dueToday} />
            <Group title="Cette semaine" tasks={thisWeek} />
            <Group title="Plus tard ou sans échéance" tasks={later} />
            {mine.length === 0 && (
              <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
                <p className="font-display text-[17px] font-semibold">Aucune tâche assignée</p>
                <p className="mt-1 text-[13px] text-muted">
                  Ouvrez un projet, ou tapez Ctrl K pour créer une tâche n&apos;importe où.
                </p>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <Panel
            icon={<Hourglass className="size-4 text-st-waiting" />}
            title="Bloqué côté client"
            count={waiting.length}
            empty="Rien n'attend le client."
          >
            {[...waitingByProject.values()].map((tasks) => (
              <div key={tasks[0].project.slug} className="py-2.5 first:pt-0 last:pb-0">
                <Link href={`/projects/${tasks[0].project.slug}`} className="flex items-center gap-2 text-[13px] font-medium hover:underline">
                  <ProjectTile color={tasks[0].project.color} label={tasks[0].project.key} size={16} />
                  {tasks[0].project.name}
                  <span className="tabular ml-auto text-[11px] font-normal text-muted">{tasks.length}</span>
                </Link>
                <ul className="mt-1.5 space-y-1 pl-6">
                  {tasks.slice(0, 4).map((task) => {
                    const days = differenceInCalendarDays(now, task.updatedAt);
                    return (
                      <li key={task.id} className="flex items-baseline gap-2 text-[12px]">
                        <span className="min-w-0 flex-1 truncate text-ink-2">{task.title}</span>
                        <span className={`tabular shrink-0 ${days >= 5 ? "font-semibold text-st-waiting" : "text-faint"}`}>
                          {days === 0 ? "auj." : `${days} j`}
                        </span>
                      </li>
                    );
                  })}
                  {tasks.length > 4 && <li className="text-[11px] text-faint">+ {tasks.length - 4} autres</li>}
                </ul>
              </div>
            ))}
          </Panel>

          <Panel
            icon={<StatusIcon status="REVIEW" size={16} />}
            title="À valider"
            count={review.length}
            empty="Rien à valider."
          >
            <ul className="space-y-1.5">
              {review.map((task) => (
                <li key={task.id} className="flex items-center gap-2 text-[12px]">
                  <ProjectTile color={task.project.color} label={task.project.key} size={14} />
                  <span className="min-w-0 flex-1 truncate text-ink-2">{task.title}</span>
                  <span className="font-mono text-[10px] text-faint">{task.project.key}-{task.number}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel icon={<Rocket className="size-4 text-st-done" />} title="Dernières mises en ligne" count={deliveries.length} empty="Aucune mise en ligne enregistrée.">
            <ol className="space-y-3">
              {deliveries.map((delivery) => (
                <li key={delivery.id} className="flex gap-2.5">
                  <ProjectTile color={delivery.project.color} label={delivery.project.key} size={16} />
                  <div className="min-w-0 text-[12px]">
                    <p className="truncate font-medium text-ink">{delivery.title}</p>
                    <p className="text-muted" title={formatDateTime(delivery.deployedAt)}>
                      {delivery.project.name} · {timeAgo(delivery.deployedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Group({ title, tasks, tone }: { title: string; tasks: TaskWithProject[]; tone?: "danger" }) {
  if (tasks.length === 0) return null;
  return (
    <section>
      <h2 className={`mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider ${tone === "danger" ? "text-danger" : "text-faint"}`}>
        {title}
        <span className="tabular font-normal">{tasks.length}</span>
      </h2>
      <ul className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} projectKey={task.project.key} project={task.project} />
        ))}
      </ul>
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
    <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
        {icon}
        {title}
        <span className="tabular ml-auto text-[12px] font-normal text-muted">{count}</span>
      </h2>
      {count === 0 ? <p className="text-[12px] text-muted">{empty}</p> : <div className="divide-y divide-line">{children}</div>}
    </section>
  );
}
