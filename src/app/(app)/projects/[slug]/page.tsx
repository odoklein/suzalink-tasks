import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProjectView, type ProjectTab } from "@/components/project-view";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { taskCardSelect } from "@/lib/types";

const TABS: ProjectTab[] = ["tableau", "liste", "mises-en-ligne", "activite"];

export async function generateMetadata(props: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const project = await db.project.findUnique({ where: { slug }, select: { name: true } });
  return { title: project?.name ?? "Projet" };
}

export default async function ProjectPage(props: PageProps<"/projects/[slug]">) {
  await verifySession();
  const { slug } = await props.params;
  const { vue, source } = await props.searchParams;

  const project = await db.project.findUnique({
    where: { slug },
    include: {
      client: {
        select: {
          name: true,
          kind: true,
          contacts: true,
          contactRecords: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            take: 1,
            select: { name: true, role: true, email: true },
          },
        },
      },
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
  if (!project || project.archived) notFound();

  const tab = TABS.includes(vue as ProjectTab) ? (vue as ProjectTab) : "tableau";

  return <ProjectView project={project} initialTab={tab} sourceFilter={typeof source === "string" ? source : null} />;
}
