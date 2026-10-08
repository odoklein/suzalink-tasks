"use client";

import { Command } from "cmdk";
import { Building2, CalendarCheck2, CornerDownLeft, FolderKanban, Plus, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { quickAddTask } from "@/app/actions/tasks";
import { useApp } from "@/components/app-context";
import { Kbd, ProjectTile } from "@/components/primitives";
import { creationTargets, readLastProject, rememberLastProject } from "@/lib/last-project";

const itemClass =
  "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink-2 data-[selected=true]:bg-sunken data-[selected=true]:text-ink";

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, paletteOpen, setPaletteOpen, setNewProjectOpen } = useApp();
  const [query, setQuery] = useState("");
  // Mode création explicite (« + » en tête, ou l'entrée « Créer une tâche… ») : Entrée ne crée
  // jamais une tâche par accident quand on voulait aller quelque part.
  const [createMode, setCreateMode] = useState(false);
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
    setCreateMode(false);
  };
  const creating = createMode || query.startsWith("+");
  const title = (query.startsWith("+") ? query.slice(1) : query).trim();
  const currentSlug = pathname.startsWith("/projects/") ? pathname.split("/")[2] : null;
  const targets = creating ? creationTargets(projects, currentSlug, readLastProject()) : [];
  const go = (href: string) => {
    close();
    router.push(href);
  };
  const createIn = (project: { id: string; name: string; slug: string }) => {
    if (!title) return;
    startTransition(async () => {
      const result = await quickAddTask(project.id, title);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      rememberLastProject(project.slug);
      toast.success(`Tâche ${result.ref} créée dans ${project.name}`);
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
        shouldFilter={!creating}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
          // Retour arrière sur un champ vide : on quitte le mode création.
          if (event.key === "Backspace" && createMode && query === "") setCreateMode(false);
        }}
        className="animate-pop-in w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
      >
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder={creating ? "Titre de la tâche, puis choisissez le projet…" : "Aller à un projet… (« + » pour créer une tâche)"}
          className="w-full border-b border-line bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-faint"
        />
        <Command.List className="max-h-[360px] overflow-y-auto p-1.5 scroll-thin">
          <Command.Empty className="px-3 py-6 text-center text-[13px] text-muted">Rien ne correspond.</Command.Empty>

          {creating && (
            <Command.Group
              heading={title ? `Créer « ${title} » dans` : "Créer une tâche : tapez d’abord le titre"}
              className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint"
            >
              {targets.map((project) => (
                <Command.Item
                  key={`create-${project.id}`}
                  value={`create-${project.id}`}
                  disabled={pending || !title}
                  onSelect={() => createIn(project)}
                  className={itemClass}
                >
                  <ProjectTile color={project.color} label={project.key} size={18} />
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{project.name}</span>
                  <CornerDownLeft className="size-3.5 text-faint" />
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {!creating && (
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

          )}

          {!creating && (
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
          )}

          {!creating && (
            <Command.Group className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint">
              {/* Toujours visible, mais classée après les résultats : Entrée va d'abord au projet trouvé. */}
              <Command.Item value="creer une tache" forceMount onSelect={() => setCreateMode(true)} className={itemClass}>
                <Plus className="size-4 text-muted" /> Créer une tâche…
              </Command.Item>
            </Command.Group>
          )}
        </Command.List>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> naviguer</span>
          <span className="flex items-center gap-1"><Kbd>Entrée</Kbd> valider</span>
          <span className="ml-auto">{creating ? "@odo !haute #homepage demain" : "+ titre : créer une tâche"}</span>
        </div>
      </Command>
    </div>
  );
}
