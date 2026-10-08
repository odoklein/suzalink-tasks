"use client";

import { Building2, CalendarCheck2, ChevronRight, FolderKanban, LogOut, Menu, Plus, Search, Settings, SquarePen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/app/actions/auth";
import { useApp } from "@/components/app-context";
import { useOpenNewTask } from "@/components/new-task-dialog";
import { Avatar } from "@/components/primitives";
import { Button, IconButton } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { projectSwatchVars } from "@/lib/color";
import { PROJECT_STATUS_BY_VALUE } from "@/lib/constants";
import type { ProjectNavItem } from "@/lib/dal";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Aujourd'hui", icon: CalendarCheck2 },
  { href: "/projects", label: "Projets", icon: FolderKanban },
  { href: "/clients", label: "Clients", icon: Building2 },
];

/** Barre du haut sur téléphone : la barre latérale s'ouvre en tiroir. */
export function MobileBar() {
  const { setNavOpen, setPaletteOpen } = useApp();
  const openNewTask = useOpenNewTask();
  return (
    <header className="flex shrink-0 items-center gap-1 border-b border-line bg-surface-2 px-2 py-2 md:hidden">
      <IconButton label="Ouvrir le menu" onClick={() => setNavOpen(true)}>
        <Menu className="size-4" />
      </IconButton>
      <span className="flex size-6 items-center justify-center rounded-sm bg-ink text-xs font-bold text-bg">S</span>
      <span className="text-body font-semibold tracking-[-0.01em]">Suzali Tasks</span>
      <IconButton label="Rechercher" className="ml-auto" onClick={() => setPaletteOpen(true)}>
        <Search className="size-4" />
      </IconButton>
      <IconButton label="Nouvelle tâche" variant="primary" onClick={openNewTask}>
        <SquarePen className="size-4" />
      </IconButton>
    </header>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, projects, setPaletteOpen, setNewProjectOpen, navOpen, setNavOpen } = useApp();
  const openNewTask = useOpenNewTask();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const close = () => setNavOpen(false);

  const live = projects.filter((project) => project.status !== "DONE");
  const delivered = projects.filter((project) => project.status === "DONE");
  const deliveredActive = delivered.some((project) => pathname.startsWith(`/projects/${project.slug}`));

  return (
    <>
      {navOpen && <div className="animate-fade-in fixed inset-0 z-sidebar bg-[var(--scrim)] md:hidden" onClick={close} aria-hidden="true" />}
      <aside
        aria-label="Menu"
        className={cn(
          "flex h-full w-[272px] shrink-0 flex-col border-r border-line bg-chrome transition-transform duration-200",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-sidebar max-md:shadow-pop",
          navOpen ? "max-md:translate-x-0" : "max-md:invisible max-md:-translate-x-full",
          "md:w-[var(--sidebar-w)]",
        )}
      >
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <span className="flex size-7 items-center justify-center rounded-md bg-ink text-ui font-bold text-bg">S</span>
          <div className="leading-tight">
            <p className="text-body font-semibold tracking-[-0.01em]">Suzali Tasks</p>
            <p className="text-meta text-muted">Suzali Conseil</p>
          </div>
        </div>

        <div className="space-y-1.5 px-3">
          <Button
            variant="primary"
            icon={<SquarePen className="size-3.5" />}
            onClick={() => {
              close();
              openNewTask();
            }}
            className="w-full justify-start font-semibold shadow-card"
          >
            <span className="flex-1 text-left">Nouvelle tâche</span>
            <Kbd onInk>C</Kbd>
          </Button>
          <Button
            variant="secondary"
            icon={<Search className="size-3.5" />}
            onClick={() => {
              close();
              setPaletteOpen(true);
            }}
            className="w-full justify-start text-muted shadow-card"
          >
            <span className="flex-1 text-left">Rechercher, créer…</span>
            <Kbd keys="Mod+K" />
          </Button>
        </div>

        <nav className="mt-4 space-y-0.5 px-3" aria-label="Navigation principale">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={close}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-ui font-medium transition-colors",
                isActive(href) ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:bg-sunken",
              )}
            >
              <Icon className={cn("size-4", isActive(href) ? "text-accent" : "text-muted")} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 flex items-center justify-between px-5">
          <p className="text-meta font-semibold uppercase tracking-[0.08em] text-muted">Projets</p>
          <IconButton
            label="Nouveau projet"
            size="sm"
            onClick={() => {
              close();
              setNewProjectOpen(true);
            }}
          >
            <Plus className="size-3.5" />
          </IconButton>
        </div>

        <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto px-3 pb-3 scroll-thin">
          <ul className="space-y-0.5">
            {live.map((project) => (
              <ProjectLink key={project.id} project={project} active={pathname.startsWith(`/projects/${project.slug}`)} onNavigate={close} />
            ))}
            {projects.length === 0 && <li className="px-2.5 py-2 text-xs text-muted">Aucun projet pour l&apos;instant.</li>}
          </ul>

          {delivered.length > 0 && (
            <details className="group/delivered mt-3" open={deliveredActive || undefined}>
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm px-2.5 py-1 text-meta font-semibold uppercase tracking-[0.08em] text-muted hover:text-muted [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-3 transition-transform group-open/delivered:rotate-90" />
                Livrés
                <span className="tabular font-normal">{delivered.length}</span>
              </summary>
              <ul className="mt-0.5 space-y-0.5">
                {delivered.map((project) => (
                  <ProjectLink key={project.id} project={project} active={pathname.startsWith(`/projects/${project.slug}`)} onNavigate={close} />
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="flex items-center gap-2.5 border-t border-line px-4 py-3">
          <Avatar name={user.name} color={user.color} size={26} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-ui font-medium">{user.name}</p>
            <p className="truncate text-meta text-muted">{user.email}</p>
          </div>
          <Link href="/settings" onClick={close} aria-label="Paramètres" className="rounded-xs p-1 text-muted hover:bg-sunken hover:text-ink">
            <Settings className="size-4" />
          </Link>
          <form action={logout}>
            <IconButton label="Se déconnecter" type="submit" size="sm">
              <LogOut className="size-4" />
            </IconButton>
          </form>
        </div>
      </aside>
    </>
  );
}

function ProjectLink({ project, active, onNavigate }: { project: ProjectNavItem; active: boolean; onNavigate: () => void }) {
  return (
    <li>
      <Link
        href={`/projects/${project.slug}`}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-ui transition-colors",
          active ? "bg-surface font-medium text-ink shadow-card" : "text-ink-2 hover:bg-sunken",
        )}
      >
        <span className="project-swatch size-2.5 shrink-0 rounded-xs" style={projectSwatchVars(project.color)} />
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
        {project.status === "WAITING_CLIENT" && (
          <Tooltip content={PROJECT_STATUS_BY_VALUE.WAITING_CLIENT.label}>
            <span className="size-1.5 rounded-full bg-waiting" />
          </Tooltip>
        )}
        {project._count.tasks > 0 && <span className="tabular text-meta text-muted">{project._count.tasks}</span>}
      </Link>
    </li>
  );
}
