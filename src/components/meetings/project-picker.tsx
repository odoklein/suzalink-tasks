"use client";

import { FolderKanban } from "lucide-react";

import { setMeetingProjectAction } from "@/app/actions/meetings";
import { useApp } from "@/components/app-context";
import { useMeetingAction } from "@/components/meetings/use-meeting-action";
import { ProjectTile } from "@/components/primitives";
import { SelectMenu } from "@/components/select-menu";
import { Badge } from "@/components/ui/badge";

const NONE = "__aucun__";

/** Projet de la réunion : suggestion à confirmer, ou choix à la main. Figé dès qu'une tâche en est issue. */
export function ProjectPicker({
  meetingId,
  projectId,
  suggested,
  locked = false,
}: {
  meetingId: string;
  projectId: string | null;
  /** Projet proposé automatiquement et pas encore confirmé. */
  suggested: boolean;
  locked?: boolean;
}) {
  const { projects } = useApp();
  const { pending, run } = useMeetingAction();
  const project = projects.find((item) => item.id === projectId) ?? null;

  const choose = (value: string) => {
    const next = value === NONE ? null : value;
    if (next === projectId && !suggested) return;
    run(() => setMeetingProjectAction(meetingId, next), next ? "Projet associé" : "Projet retiré");
  };

  const label = project ? (
    <>
      <ProjectTile color={project.color} label={project.key} size={16} />
      <span className="truncate font-medium text-ink">{project.name}</span>
    </>
  ) : (
    <>
      <FolderKanban className="size-4 text-muted" />
      <span className="text-muted">Associer un projet</span>
    </>
  );

  if (locked) return <span className="inline-flex min-w-0 items-center gap-2 px-1.5 py-1 text-ui">{label}</span>;

  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" aria-busy={pending || undefined}>
      <SelectMenu<string>
        label="Projet de la réunion"
        searchable
        value={projectId}
        onChange={choose}
        options={[
          ...projects.map((item) => ({
            value: item.id,
            label: item.name,
            icon: <ProjectTile color={item.color} label={item.key} size={16} />,
          })),
          ...(projectId ? [{ value: NONE, label: "Aucun projet" }] : []),
        ]}
        trigger={label}
      />
      {project && suggested && (
        <button
          type="button"
          onClick={() => choose(project.id)}
          disabled={pending}
          className="relative rounded-full outline-hidden focus-visible:shadow-[var(--ring)] pointer-coarse:after:absolute pointer-coarse:after:-inset-3"
          aria-label={`Confirmer le projet ${project.name}`}
        >
          <Badge tone="accent" variant="outline">
            Suggéré · confirmer
          </Badge>
        </button>
      )}
    </span>
  );
}
