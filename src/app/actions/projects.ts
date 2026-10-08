"use server";

import type { ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { verifySession } from "@/lib/dal";
import { runService, webActor } from "@/lib/services/core";
import * as projects from "@/lib/services/projects";

export type ProjectFormState = { error?: string } | undefined;

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function createProject(_state: ProjectFormState, formData: FormData): Promise<ProjectFormState> {
  const { userId } = await verifySession();
  const newClient = text(formData, "newClient");
  const due = text(formData, "dueDate");
  const result = await runService(() =>
    projects.createProject(webActor(userId), {
      name: text(formData, "name"),
      key: text(formData, "key") || undefined,
      clientId: text(formData, "clientId") || null,
      newClient: newClient ? { name: newClient, kind: formData.get("clientKind") === "AGENCY" ? "AGENCY" : "DIRECT" } : null,
      color: text(formData, "color") || null,
      endClient: text(formData, "endClient"),
      siteUrl: text(formData, "siteUrl"),
      description: text(formData, "description"),
      dueDate: due ? new Date(due) : null,
    }),
  );
  if ("error" in result) return { error: result.error };
  revalidatePath("/", "layout");
  redirect(`/projects/${result.slug}`);
}

export async function updateProjectStatus(projectId: string, status: ProjectStatus) {
  const { userId } = await verifySession();
  return runService(async () => {
    await projects.updateProjectStatus(webActor(userId), projectId, status);
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

/** « Point d'étape » : où en est le projet et quelle est la prochaine action. */
export async function updateProjectNote(projectId: string, note: string) {
  const { userId } = await verifySession();
  return runService(async () => {
    await projects.updateProjectNote(webActor(userId), { projectId, note });
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

export async function archiveProject(projectId: string) {
  const { userId } = await verifySession();
  await projects.archiveProject(webActor(userId), projectId);
  revalidatePath("/", "layout");
  redirect("/projects");
}
