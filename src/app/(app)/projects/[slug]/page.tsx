import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ProjectView, type ProjectTab } from "@/components/project-view";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { taskCardSelect } from "@/lib/types";

const TABS: ProjectTab[] = ["tableau", "liste", "mises-en-ligne", "activite"];

/** Un seul chargement par requête, partagé par generateMetadata et la page (cache React). */
const loadProject = cache(async (slug: string) => {
  await verifySession();
  return db.project.findUnique({
    where: { slug },
    include: {
      client: { select: { name: true, kind: true, contacts: true } },
      lead: { select: { name: true, color: true } },
      tasks: { select: taskCardSelect, orderBy: { position: "asc" } },
      deliveries: {
        orderBy: { deployedAt: "desc" },
        include: { author: { select: { name: true, color: true } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 60,
        include: { actor: { select: { name: true, color: true } } },
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
  const { vue } = await props.searchParams;

  const project = await loadProject(slug);
  if (!project || project.archived) notFound();

  const tab = TABS.includes(vue as ProjectTab) ? (vue as ProjectTab) : "tableau";

  return <ProjectView project={project} initialTab={tab} />;
}
