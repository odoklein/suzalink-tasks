import { Hourglass, Rocket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { NewProjectButton } from "@/components/new-project-button";
import { Avatar, DueChip, ProjectTile } from "@/components/primitives";
import { PROJECT_STATUS_BY_VALUE, TASK_STATUSES } from "@/lib/constants";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Projets" };

export default async function ProjectsPage() {
  await verifySession();
  const projects = await db.project.findMany({
    where: { archived: false },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      client: { select: { name: true } },
      lead: { select: { name: true, color: true } },
      tasks: { select: { status: true, dueDate: true } },
      deliveries: { orderBy: { deployedAt: "desc" }, take: 1, select: { deployedAt: true } },
    },
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[1180px] px-8 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] font-semibold tracking-tight">Projets</h1>
            <p className="mt-1 text-[14px] text-muted">
              {projects.length} projet{projects.length > 1 ? "s" : ""} en cours
            </p>
          </div>
          <NewProjectButton />
        </div>

        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const total = project.tasks.length;
            const done = project.tasks.filter((task) => task.status === "DONE").length;
            const waiting = project.tasks.filter((task) => task.status === "WAITING_CLIENT").length;
            const nextDue = project.tasks
              .filter((task) => task.status !== "DONE" && task.dueDate)
              .map((task) => task.dueDate as Date)
              .sort((a, b) => a.getTime() - b.getTime())[0];
            const status = PROJECT_STATUS_BY_VALUE[project.status];
            const lastDelivery = project.deliveries[0]?.deployedAt;

            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.slug}`}
                  className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 shadow-card transition-[border-color,transform] hover:-translate-y-0.5 hover:border-line-strong"
                >
                  <div className="flex items-start gap-3">
                    <ProjectTile color={project.color} label={project.key} size={34} />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-display text-[17px] font-semibold tracking-tight group-hover:text-accent">
                        {project.name}
                      </h2>
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

                  <div className="mt-5">
                    <div className="flex items-baseline justify-between text-[12px]">
                      <span className="text-muted">Avancement</span>
                      <span className="tabular font-medium">
                        {done}/{total}
                        <span className="ml-1.5 text-muted">{total ? Math.round((done / total) * 100) : 0} %</span>
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

                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5 text-[12px] text-muted">
                    {waiting > 0 && (
                      <span className="flex items-center gap-1 font-medium text-st-waiting">
                        <Hourglass className="size-3.5" />
                        {waiting} chez le client
                      </span>
                    )}
                    {lastDelivery && (
                      <span className="flex items-center gap-1">
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
              </li>
            );
          })}
        </ul>

        {projects.length === 0 && (
          <div className="mt-10 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
            <p className="font-display text-[18px] font-semibold">Aucun projet</p>
            <p className="mt-1 text-[13px] text-muted">Créez le premier projet pour commencer à suivre les tâches.</p>
            <div className="mt-5 flex justify-center">
              <NewProjectButton />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
