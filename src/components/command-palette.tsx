"use client";

import { Command } from "cmdk";
import {
  Building2,
  CalendarCheck2,
  CornerDownLeft,
  FileSpreadsheet,
  FolderKanban,
  History,
  LogOut,
  MessageSquareText,
  Plus,
  Rocket,
  Settings,
  SunMoon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { logout } from "@/app/actions/auth";
import { setTheme } from "@/app/actions/preferences";
import { searchTasks, type TaskSearchResult } from "@/app/actions/search";
import { quickAddTask } from "@/app/actions/tasks";
import { useApp } from "@/components/app-context";
import { Kbd, ProjectTile, StatusIcon } from "@/components/primitives";
import { requestProjectAction, type ProjectAction } from "@/lib/project-actions";
import { readRecentTasks, type RecentTask } from "@/lib/recent-tasks";
import { parseTheme, THEME_LABELS, THEMES, themeAttribute } from "@/lib/theme";

const groupClass =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted";

const PROJECT_ACTIONS: { action: ProjectAction; label: string; keys: string; icon: React.ReactNode }[] = [
  { action: "import", label: "Importer des retours", keys: "Shift+I", icon: <FileSpreadsheet className="size-4 text-muted" /> },
  { action: "recap", label: "Récap client", keys: "Shift+R", icon: <MessageSquareText className="size-4 text-muted" /> },
  { action: "delivery", label: "Mise en ligne", keys: "Shift+D", icon: <Rocket className="size-4 text-muted" /> },
];

/** Thème suivant dans le cycle Système → Clair → Sombre, appliqué tout de suite. */
function cycleTheme() {
  const current = parseTheme(document.documentElement.dataset.theme);
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  const attribute = themeAttribute(next);
  if (attribute) document.documentElement.dataset.theme = attribute;
  else delete document.documentElement.dataset.theme;
  toast.success(`Thème : ${THEME_LABELS[next]}`);
  void setTheme(next);
}

const itemClass =
  "flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-ui text-ink-2 data-[selected=true]:bg-sunken data-[selected=true]:text-ink";

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { projects, paletteOpen, setPaletteOpen, setNewProjectOpen, openTask } = useApp();
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<{ query: string; tasks: TaskSearchResult[] }>({ query: "", tasks: [] });
  const onProjectPage = pathname.startsWith("/projects/");

  // Recherche serveur, 150 ms après la dernière frappe ; une réponse tardive est ignorée.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let stale = false;
    const timer = setTimeout(() => {
      searchTasks(q)
        .then((tasks) => !stale && setResults({ query: q, tasks }))
        .catch(() => {});
    }, 150);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query]);
  const tasks = query.trim().length >= 2 && results.query === query.trim() ? results.tasks : [];

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
  // Lu à chaque rendu de la palette ouverte (jamais côté serveur : elle est fermée au départ).
  const recent: RecentTask[] = readRecentTasks();

  const close = () => {
    setPaletteOpen(false);
    setQuery("");
  };
  const go = (href: string) => {
    close();
    router.push(href);
  };
  const openFound = (task: { id: string; ref: string }) => {
    close();
    openTask(task.id, task.ref);
  };
  const run = (action: () => void) => {
    close();
    action();
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
      className="animate-fade-in fixed inset-0 z-palette flex items-start justify-center bg-[var(--scrim)] px-4 pt-[14vh] backdrop-blur-[2px]"
      onMouseDown={close}
    >
      <Command
        label="Palette de commandes"
        loop
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && close()}
        className="animate-pop-in w-full max-w-xl overflow-hidden rounded-lg border border-line bg-surface shadow-pop"
      >
        <Command.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder="Chercher une tâche (BG-12, mot du titre), un projet, une action…"
          className="w-full border-b border-line bg-transparent px-4 py-3.5 text-body outline-none placeholder:text-faint"
        />
        <Command.List className="max-h-[360px] overflow-y-auto p-1.5 scroll-thin">
          <Command.Empty className="px-3 py-6 text-center text-ui text-muted">Rien ne correspond.</Command.Empty>

          {tasks.length > 0 && (
            <Command.Group heading="Tâches" className={groupClass}>
              {tasks.map((task) => (
                <Command.Item
                  key={task.id}
                  value={`${task.ref} ${task.title} ${task.zone ?? ""} ${task.project.name}`}
                  onSelect={() => openFound(task)}
                  className={itemClass}
                >
                  <StatusIcon status={task.status} />
                  <span className="w-14 shrink-0 font-mono text-meta text-muted">{task.ref}</span>
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  <ProjectTile color={task.project.color} label={task.project.key} size={16} />
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {!query.trim() && recent.length > 0 && (
            <Command.Group heading="Récemment consultées" className={groupClass}>
              {recent.map((task) => (
                <Command.Item key={task.id} value={`recent ${task.ref} ${task.title}`} onSelect={() => openFound(task)} className={itemClass}>
                  <History className="size-4 text-muted" />
                  <span className="w-14 shrink-0 font-mono text-meta text-muted">{task.ref}</span>
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {query.trim().length > 2 && (
            <Command.Group
              heading="Créer une tâche"
              className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-meta [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted"
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
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-meta [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted"
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

          <Command.Group heading="Actions" className={groupClass}>
            {onProjectPage &&
              PROJECT_ACTIONS.map((item) => (
                <Command.Item
                  key={item.action}
                  value={`action ${item.label}`}
                  onSelect={() => run(() => requestProjectAction(item.action))}
                  className={itemClass}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  <Kbd keys={item.keys} />
                </Command.Item>
              ))}
            <Command.Item value="action theme clair sombre" onSelect={() => run(cycleTheme)} className={itemClass}>
              <SunMoon className="size-4 text-muted" />
              <span className="flex-1">Changer de thème</span>
            </Command.Item>
            <Command.Item value="action se deconnecter" onSelect={() => run(() => void logout())} className={itemClass}>
              <LogOut className="size-4 text-muted" />
              <span className="flex-1">Se déconnecter</span>
            </Command.Item>
          </Command.Group>

          <Command.Group
            heading="Projets"
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-meta [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted"
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
                <span className="tabular text-meta text-muted">{project._count.tasks} ouvertes</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-meta text-muted">
          <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> naviguer</span>
          <span className="flex items-center gap-1"><Kbd>Entrée</Kbd> valider</span>
          <span className="flex items-center gap-1"><Kbd keys="Mod+K" /> fermer</span>
          <span className="ml-auto">@odo !haute #homepage demain</span>
        </div>
      </Command>
    </div>
  );
}
