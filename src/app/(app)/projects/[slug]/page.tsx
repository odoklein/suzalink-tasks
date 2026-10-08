import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ProjectView, type ProjectTab } from "@/components/project-view";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { taskCardSelect } from "@/lib/types";

const TABS: ProjectTab[] = ["tableau", "liste", "retours", "avenants", "mises-en-ligne", "activite"];

/** Un seul chargement par requête, partagé par generateMetadata et la page (cache React). */
const loadProject = cache(async (slug: string) => {
  await verifySession();
  return db.project.findUnique({
    where: { slug },
    include: {
      client: {
        select: {
          name: true,
          kind: true,
          contacts: true,
          contactRecords: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            select: { id: true, name: true, role: true, email: true },
          },
        },
      },
      lead: { select: { name: true, color: true } },
      tasks: { select: taskCardSelect, orderBy: { position: "asc" } },
      deliveries: {
        where: { deletedAt: null },
        orderBy: { deployedAt: "desc" },
        include: {
          author: { select: { name: true, color: true } },
          tasks: { select: { task: { select: { id: true, number: true, title: true, zone: true } } } },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 60,
        include: { actor: { select: { name: true, color: true } } },
      },
      clientMessages: { orderBy: { sentAt: "desc" }, take: 30, select: { id: true, body: true, kind: true, sentAt: true } },
      extras: {
        orderBy: { number: "desc" },
        select: {
          id: true,
          number: true,
          title: true,
          amountCents: true,
          status: true,
          quotedAt: true,
          approvedAt: true,
          approvedBy: true,
          invoicedAt: true,
          invoiceRef: true,
          paidAt: true,
        },
      },
      rounds: {
        orderBy: { receivedAt: "desc" },
        select: {
          id: true,
          label: true,
          receivedAt: true,
          status: true,
          rawText: true,
          fromContact: { select: { name: true } },
          closedBy: { select: { title: true, deployedAt: true } },
        },
      },
    },
  });
});

export async function generateMetadata(props: PageProps<"/projects/[slug]">): Promise<Metadata> {
  await verifySession();
  const { slug } = await props.params;
  const project = await loadProject(slug);
  return { title: project && !project.archived ? project.name : "Projet" };
}

export default async function ProjectPage(props: PageProps<"/projects/[slug]">) {
  await verifySession();
  const { slug } = await props.params;
  const { vue, source } = await props.searchParams;

  const project = await loadProject(slug);
  if (!project || project.archived) notFound();

  const tab = TABS.includes(vue as ProjectTab) ? (vue as ProjectTab) : "tableau";

  return <ProjectView project={project} initialTab={tab} sourceFilter={typeof source === "string" ? source : null} />;
}
