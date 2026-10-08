import type { Metadata } from "next";
import Link from "next/link";

import { ClientContacts } from "@/components/client-contacts";
import { ProjectTile, StatusIcon } from "@/components/primitives";
import { Badge, type Tone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PROJECT_STATUS_BY_VALUE } from "@/lib/constants";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { initials } from "@/lib/utils";

const STATUS_TONE: Record<string, Tone> = { ACTIVE: "progress", WAITING_CLIENT: "waiting", PAUSED: "todo", DONE: "done" };

type ClientProject = {
  id: string;
  name: string;
  slug: string;
  key: string;
  color: string;
  status: string;
  endClient: string | null;
  _count: { tasks: number };
};

function ProjectLine({ project, nested = false }: { project: ClientProject; nested?: boolean }) {
  const status = PROJECT_STATUS_BY_VALUE[project.status as keyof typeof PROJECT_STATUS_BY_VALUE];
  return (
    <li>
      <Link href={`/projects/${project.slug}`} className={`flex items-center gap-3 py-2.5 pr-3 text-ui hover:bg-surface-2 ${nested ? "pl-9" : "pl-3"}`}>
        <ProjectTile color={project.color} label={project.key} size={18} />
        <span className="font-medium">{project.name}</span>
        {!nested && project.endClient && <span className="truncate text-muted">{project.endClient}</span>}
        <span className="ml-auto flex items-center gap-3">
          {project._count.tasks > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-waiting-text">
              <StatusIcon status="WAITING_CLIENT" size={12} />
              {project._count.tasks} chez le client
            </span>
          )}
          <Badge tone={STATUS_TONE[project.status] ?? "neutral"}>{status.label}</Badge>
        </span>
      </Link>
    </li>
  );
}

export const metadata: Metadata = { title: "Clients" };

function groupByEndClient(projects: ClientProject[]): [string | null, ClientProject[]][] {
  const groups = new Map<string | null, ClientProject[]>();
  for (const project of projects) {
    const key = project.endClient?.trim() || null;
    groups.set(key, [...(groups.get(key) ?? []), project]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : a.localeCompare(b, "fr")));
}

export default async function ClientsPage() {
  await verifySession();
  const clients = await db.client.findMany({
    orderBy: { name: "asc" },
    include: {
      contactRecords: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: { id: true, name: true, role: true, email: true, phone: true, isPrimary: true },
      },
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
      <div className="mx-auto max-w-[var(--page-medium)] px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="font-display text-h1 font-semibold tracking-tight">Clients</h1>
        <p className="mt-1 text-body text-muted">Agences partenaires et clients directs, avec leurs projets.</p>

        <ul className="mt-6 space-y-3">
          {clients.map((client) => (
            <li key={client.id} className="rounded-lg border border-line bg-surface p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-md bg-sunken text-ui font-semibold text-ink-2">
                  {initials(client.name)}
                </span>
                <h2 className="text-title font-semibold tracking-[-0.01em]">{client.name}</h2>
                <Badge tone={client.kind === "AGENCY" ? "accent" : "neutral"}>
                  {client.kind === "AGENCY" ? "Agence partenaire" : "Client direct"}
                </Badge>
              </div>
              <ClientContacts clientId={client.id} contacts={client.contactRecords} legacy={client.contacts} />
              {client.notes && <p className="mt-2 text-ui leading-relaxed text-ink-2">{client.notes}</p>}

              {client.projects.length > 0 && (
                <ul className="mt-4 divide-y divide-line rounded-md border border-line">
                  {client.kind === "AGENCY"
                    ? // Agence : les projets sont regroupés sous leur client final.
                      groupByEndClient(client.projects).map(([endClient, projects]) =>
                        endClient ? (
                          <li key={endClient}>
                            <p className="bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-2">{endClient}</p>
                            <ul className="divide-y divide-line">
                              {projects.map((project) => (
                                <ProjectLine key={project.id} project={project} nested />
                              ))}
                            </ul>
                          </li>
                        ) : (
                          projects.map((project) => <ProjectLine key={project.id} project={project} />)
                        ),
                      )
                    : client.projects.map((project) => <ProjectLine key={project.id} project={project} />)}
                </ul>
              )}
            </li>
          ))}
        </ul>

        {clients.length === 0 && (
          <EmptyState title="Aucun client" className="mt-8 rounded-lg border border-dashed border-line-strong">
            Les clients apparaissent ici dès qu&apos;ils sont rattachés à un projet.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
