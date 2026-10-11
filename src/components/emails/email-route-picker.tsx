"use client";

import { Building2, FolderKanban } from "lucide-react";

import { setEmailRouteAction } from "@/app/actions/emails";
import { useMeetingAction } from "@/components/meetings/use-meeting-action";
import { ProjectTile } from "@/components/primitives";
import { SelectMenu } from "@/components/select-menu";
import type { RoutingOptions } from "@/lib/emails/queries";

const NONE = "__aucun__";

/** Client et projet d'un e-mail : corrigés à la main si le rattachement automatique s'est trompé. */
export function EmailRoutePicker({
  emailId,
  clientId,
  projectId,
  options,
  locked = false,
}: {
  emailId: string;
  clientId: string | null;
  projectId: string | null;
  options: RoutingOptions;
  /** Des tâches en sont issues : le projet ne change plus. */
  locked?: boolean;
}) {
  const { pending, run } = useMeetingAction();
  const client = options.clients.find((item) => item.id === clientId) ?? null;
  const project = options.projects.find((item) => item.id === projectId) ?? null;
  const projects = clientId ? options.projects.filter((item) => item.clientId === clientId) : options.projects;

  const setClient = (value: string) => {
    const next = value === NONE ? null : value;
    if (next === clientId) return;
    const keepProject = project && project.clientId === next ? project.id : null;
    run(() => setEmailRouteAction(emailId, { clientId: next, projectId: keepProject }), next ? "Client associé" : "Client retiré");
  };
  const setProject = (value: string) => {
    const next = value === NONE ? null : value;
    if (next === projectId) return;
    const chosen = options.projects.find((item) => item.id === next);
    run(() => setEmailRouteAction(emailId, { projectId: next, clientId: chosen?.clientId ?? clientId }), next ? "Projet associé" : "Projet retiré");
  };

  const projectLabel = project ? (
    <>
      <ProjectTile color={project.color} label={project.key} size={16} />
      <span className="truncate font-medium text-ink">{project.name}</span>
    </>
  ) : (
    <>
      <FolderKanban className="size-4 text-muted" aria-hidden="true" />
      <span className="text-muted">Associer un projet</span>
    </>
  );

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1" aria-busy={pending || undefined}>
      <SelectMenu<string>
        label="Client de l’e-mail"
        searchable
        value={clientId}
        onChange={setClient}
        options={[...options.clients.map((item) => ({ value: item.id, label: item.name })), ...(clientId ? [{ value: NONE, label: "Aucun client" }] : [])]}
        trigger={
          <>
            <Building2 className="size-4 text-muted" aria-hidden="true" />
            <span className={client ? "font-medium text-ink" : "text-muted"}>{client?.name ?? "Associer un client"}</span>
          </>
        }
      />
      {locked ? (
        <span className="inline-flex min-w-0 items-center gap-2 px-1.5 py-1 text-ui">{projectLabel}</span>
      ) : (
        <SelectMenu<string>
          label="Projet de l’e-mail"
          searchable
          value={projectId}
          onChange={setProject}
          options={[
            ...projects.map((item) => ({ value: item.id, label: item.name, icon: <ProjectTile color={item.color} label={item.key} size={16} /> })),
            ...(projectId ? [{ value: NONE, label: "Aucun projet" }] : []),
          ]}
          trigger={projectLabel}
        />
      )}
    </span>
  );
}
