"use client";

import { Command } from "cmdk";
import { Building2, CalendarCheck2, CornerDownLeft, FolderKanban, Plus, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { quickAddTask } from "@/app/actions/tasks";
import { useApp } from "@/components/app-context";
import { Kbd, ProjectTile } from "@/components/primitives";

const itemClass =
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink-2 data-[selected=true]:bg-sunken data-[selected=true]:text-ink";

export function CommandPalette() {
  const router = useRouter();
  const { projects, paletteOpen, setPaletteOpen, setNewProjectOpen } = useApp();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paletteOpen, setPaletteOpen]);

  if (!paletteOpen) return null;

  const close = () => {
    setPaletteOpen(false);
    setQuery("");
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };
  const createIn = (projectId: string, projectName: string) => {
    startTransition(async () => {
      const result = await quickAddTask(projectId, query);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Tâche ${result.ref} créée dans ${projectName}`);
      close();
    });
  };

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-start justify-center bg-[rgb(10_12_16/0.42)] px-4 pt-[14vh] backdrop-blur-[2px]"
      onMouseDown={close}
    >
      <Command
        label="Palette de commandes"
        loop
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && close()}
        className="animate-pop-in w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
      >
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Aller à un projet, ou taper une tâche à créer…"
          className="w-full border-b border-line bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-faint"
        />
        <Command.List className="max-h-[360px] overflow-y-auto p-1.5 scroll-thin">
          <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted">Rien ne correspond.</Command.Empty>

          {query.trim().length > 2 && (
            <Command.Group
              heading="Créer une tâche"
              className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint"
            >
              {projects.slice(0, 6).map((project) => (
                <Command.Item
                  key={`create-${project.id}`}
                  value={`creer ${query} ${project.name}`}
                  disabled={pending}
                  onSelect={() => createIn(project.id, project.name)}
                  className={itemClass}
                >
                  <Plus className="size-4 text-muted" />
                  <span className="min-w-0 flex-1 truncate">
                    « {query.trim()} » dans <span className="font-medium text-ink">{project.name}</span>
                  </span>
                  <CornerDownLeft className="size-3.5 text-faint" />
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group
            heading="Aller à"
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint"
          >
            <Command.Item value="aujourd'hui accueil" onSelect={() => go("/")} className={itemClass}>
              <CalendarCheck2 className="size-4 text-muted" /> Aujourd&apos;hui
            </Command.Item>
            <Command.Item value="projets" onSelect={() => go("/projects")} className={itemClass}>
              <FolderKanban className="size-4 text-muted" /> Projets
            </Command.Item>
            <Command.Item value="clients agences" onSelect={() => go("/clients")} className={itemClass}>
              <Building2 className="size-4 text-muted" /> Clients
            </Command.Item>
            <Command.Item value="parametres mot de passe" onSelect={() => go("/settings")} className={itemClass}>
              <Settings className="size-4 text-muted" /> Paramètres
            </Command.Item>
            <Command.Item
              value="nouveau projet"
              onSelect={() => {
                close();
                setNewProjectOpen(true);
              }}
              className={itemClass}
            >
              <Plus className="size-4 text-muted" /> Nouveau projet
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="Projets"
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint"
          >
            {projects.map((project) => (
              <Command.Item
                key={project.id}
                value={`${project.name} ${project.key}`}
                onSelect={() => go(`/projects/${project.slug}`)}
                className={itemClass}
              >
                <ProjectTile color={project.color} label={project.key} size={18} />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                <span className="tabular text-[11px] text-faint">{project._count.tasks} ouvertes</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> naviguer</span>
          <span className="flex items-center gap-1"><Kbd>Entrée</Kbd> valider</span>
          <span className="ml-auto">@odo !haute #homepage demain</span>
        </div>
      </Command>
    </div>
  );
}
