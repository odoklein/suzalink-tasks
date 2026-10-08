"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useApp } from "@/components/app-context";
import { Dialog } from "@/components/dialog";
import { Kbd, ProjectTile } from "@/components/primitives";
import { QuickAdd } from "@/components/quick-add";
import { SelectMenu } from "@/components/select-menu";

/**
 * Création de tâche depuis n'importe quel écran (touche C ou bouton de la barre
 * latérale). Le projet affiché est présélectionné.
 */
export function NewTaskDialog() {
  const { projects, newTaskOpen, setNewTaskOpen } = useApp();
  const pathname = usePathname();
  const currentSlug = pathname.startsWith("/projects/") ? pathname.split("/")[2] : null;
  const [chosen, setChosen] = useState<string | null>(null);

  const projectId =
    chosen ?? projects.find((project) => project.slug === currentSlug)?.id ?? projects[0]?.id ?? null;
  const project = projects.find((item) => item.id === projectId);

  // Raccourci clavier « C », sauf pendant une saisie
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (!typing && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        setNewTaskOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setNewTaskOpen]);

  if (!project) return null;

  return (
    <Dialog
      open={newTaskOpen}
      onClose={() => {
        setNewTaskOpen(false);
        setChosen(null);
      }}
      title="Nouvelle tâche"
      description="Entrée pour créer ; vous pouvez en enchaîner plusieurs."
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
        <QuickAdd key={project.id} projectId={project.id} autoFocus placeholder="Titre de la tâche…" />
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md bg-surface-2 px-3 py-2.5 text-xs text-muted">
          <li><Kbd>@odo</Kbd> assigner</li>
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
