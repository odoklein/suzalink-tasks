"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useApp } from "@/components/app-context";
import { Dialog } from "@/components/dialog";
import { Kbd, ProjectTile } from "@/components/primitives";
import { QuickAdd } from "@/components/quick-add";
import { SelectMenu } from "@/components/select-menu";
import { NNBSP } from "@/lib/fr";
import { creationTargets, readLastProject } from "@/lib/last-project";

/**
 * Ouvre la création de tâche (touche C, boutons « Nouvelle tâche »). Sans aucun projet, on ne peut pas
 * créer de tâche : un toast propose d'en créer un.
 */
export function useOpenNewTask() {
  const { projects, setNewTaskOpen, setNewProjectOpen } = useApp();
  return () => {
    if (projects.length > 0) setNewTaskOpen(true);
    else toast("Créez d’abord un projet", { action: { label: "Nouveau projet", onClick: () => setNewProjectOpen(true) } });
  };
}

/**
 * Création de tâche depuis n'importe quel écran (touche C ou bouton de la barre
 * latérale). Le projet affiché est présélectionné.
 */
export function NewTaskDialog() {
  const { projects, newTaskOpen, setNewTaskOpen } = useApp();
  const openNewTask = useOpenNewTask();
  const pathname = usePathname();
  const currentSlug = pathname.startsWith("/projects/") ? pathname.split("/")[2] : null;
  const [chosen, setChosen] = useState<string | null>(null);

  // Projet affiché, sinon dernier projet utilisé, sinon premier projet actif.
  const defaultProject = newTaskOpen ? (creationTargets(projects, currentSlug, readLastProject())[0] ?? projects[0]) : undefined;
  const projectId = chosen ?? defaultProject?.id ?? null;
  const project = projects.find((item) => item.id === projectId);

  // Raccourci clavier « C », sauf pendant une saisie
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        openNewTask();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openNewTask]);

  if (!project) return null;

  return (
    <Dialog
      open={newTaskOpen}
      onClose={() => {
        setNewTaskOpen(false);
        setChosen(null);
      }}
      title="Nouvelle tâche"
      description={`Entrée pour créer${NNBSP}; vous pouvez en enchaîner plusieurs.`}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-ui text-muted">
          Dans
          <SelectMenu<string>
            label="Projet"
            searchable
            value={project.id}
            onChange={setChosen}
            options={projects.map((item) => ({
              value: item.id,
              label: item.name,
              icon: <ProjectTile color={item.color} label={item.key} size={16} />,
            }))}
            trigger={
              <>
                <ProjectTile color={project.color} label={project.key} size={16} />
                <span className="font-medium text-ink">{project.name}</span>
              </>
            }
          />
        </div>
        <QuickAdd key={project.id} projectId={project.id} projectSlug={project.slug} autoFocus placeholder="Titre de la tâche…" />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-surface-2 px-3 py-2.5 text-xs text-muted">
          <li><Kbd>@odo</Kbd> attribuer</li>
          <li><Kbd>!haute</Kbd> priorité</li>
          <li><Kbd>#homepage</Kbd> page</li>
          <li><Kbd>demain</Kbd> <Kbd>12/10</Kbd> échéance</li>
          <li><Kbd>$</Kbd> hors périmètre</li>
          <li><Kbd>Échap</Kbd> fermer</li>
        </ul>
      </div>
    </Dialog>
  );
}
