import type { Metadata } from "next";
import Link from "next/link";

import { ProjectTile } from "@/components/primitives";
import { PROJECT_STATUS_BY_VALUE } from "@/lib/constants";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  await verifySession();
  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    include: {
      projects: {
        where: { archived: false },
        select: {
          id: true,
          name: true,
          slug: true,
          key: true,
          color: true,
          status: true,
          endClient: true,
          _count: { select: { tasks: { where: { status: "WAITING_CLIENT" } } } },
        },
      },
    },
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[980px] px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="font-display text-[28px] font-semibold tracking-tight">Clients</h1>
        <p className="mt-1 text-[14px] text-muted">Agences partenaires et clients directs, avec leurs projets.</p>

        <ul className="mt-6 space-y-3">
          {clients.map((client) => (
            <li key={client.id} className="rounded-xl border border-line bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{client.name}</h2>
                <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-2">
                  {client.kind === "AGENCY" ? "Agence partenaire" : "Client direct"}
                </span>
              </div>
              {client.contacts && <p className="mt-1 text-[13px] text-muted">{client.contacts}</p>}
              {client.notes && <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{client.notes}</p>}

              {client.projects.length > 0 && (
                <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
                  {client.projects.map((project) => {
                    const status = PROJECT_STATUS_BY_VALUE[project.status];
                    return (
                      <li key={project.id}>
                        <Link href={`/projects/${project.slug}`} className="flex items-center gap-3 px-3 py-2.5 text-[13px] hover:bg-surface-2">
                          <ProjectTile color={project.color} label={project.key} size={18} />
                          <span className="font-medium">{project.name}</span>
                          {project.endClient && <span className="truncate text-muted">{project.endClient}</span>}
                          <span className="ml-auto flex items-center gap-3">
                            {project._count.tasks > 0 && (
                              <span className="text-[12px] font-medium text-st-waiting">{project._count.tasks} chez le client</span>
                            )}
                            <span className="text-[12px]" style={{ color: status.tone }}>{status.label}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>

        {clients.length === 0 && (
          <p className="mt-8 rounded-xl border border-dashed border-line-strong px-6 py-12 text-center text-[13px] text-muted">
            Les clients apparaissent ici dès qu&apos;ils sont rattachés à un projet.
          </p>
        )}
      </div>
    </div>
  );
}
