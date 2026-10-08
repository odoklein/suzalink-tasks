import { notFound, redirect } from "next/navigation";

import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { parseTaskRef } from "@/lib/task-ref";

/** Lien court d’une tâche : /t/BG-12 → page du projet avec le tiroir ouvert. */
export default async function TaskLinkPage(props: PageProps<"/t/[ref]">) {
  await verifySession();
  const { ref } = await props.params;
  const parsed = parseTaskRef(decodeURIComponent(ref));
  if (!parsed) notFound();

  const task = await db.task.findFirst({
    where: { number: parsed.number, project: { key: parsed.key } },
    select: { project: { select: { slug: true } } },
  });
  if (!task) notFound();

  redirect(`/projects/${task.project.slug}?tache=${parsed.key}-${parsed.number}`);
}
