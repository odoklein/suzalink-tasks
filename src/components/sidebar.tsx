"use client";

import { Building2, CalendarCheck2, ChevronRight, FolderKanban, LogOut, Menu, Plus, Search, Settings, SquarePen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/app/actions/auth";
import { useApp } from "@/components/app-context";
import { Avatar, Kbd } from "@/components/primitives";
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
  const { setNavOpen, setNewTaskOpen, setPaletteOpen } = useApp();
  return (
    <header className="flex shrink-0 items-center gap-1 border-b border-line bg-surface-2 px-2 py-2 md:hidden">
      <button type="button" onClick={() => setNavOpen(true)} aria-label="Ouvrir le menu" className="rounded-md p-2 text-ink-2 hover:bg-sunken">
        <Menu className="size-5" />
      </button>
      <span className="flex size-6 items-center justify-center rounded-md bg-ink font-display text-[12px] font-bold text-bg">S</span>
      <span className="font-display text-[14px] font-semibold tracking-tight">Suzali Tasks</span>
      <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Rechercher" className="ml-auto rounded-md p-2 text-ink-2 hover:bg-sunken">
        <Search className="size-5" />
      </button>
      <button type="button" onClick={() => setNewTaskOpen(true)} aria-label="Nouvelle tâche" className="rounded-md bg-ink p-2 text-bg">
        <SquarePen className="size-4" />
      </button>
    </header>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, projects, setPaletteOpen, setNewProjectOpen, setNewTaskOpen, navOpen, setNavOpen } = useApp();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const close = () => setNavOpen(false);

  const live = projects.filter((project) => project.status !== "DONE");
  const delivered = projects.filter((project) => project.status === "DONE");
  const deliveredActive = delivered.some((project) => pathname.startsWith(`/projects/${project.slug}`));

  return (
    <>
      {navOpen && <div className="animate-fade-in fixed inset-0 z-40 bg-[rgb(10_12_16/0.4)] md:hidden" onClick={close} aria-hidden="true" />}
      <aside
        aria-label="Menu"
        className={cn(
          "flex h-full w-[272px] shrink-0 flex-col border-r border-line bg-surface-2 transition-transform duration-200",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:shadow-pop",
          navOpen ? "max-md:translate-x-0" : "max-md:invisible max-md:-translate-x-full",
          "md:w-[248px]",
        )}
      >
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <span className="flex size-7 items-center justify-center rounded-lg bg-ink font-display text-[13px] font-bold text-bg">S</span>
          <div className="leading-tight">
            <p className="font-display text-[14px] font-semibold tracking-tight">Suzali Tasks</p>
            <p className="text-[11px] text-muted">Suzali Conseil</p>
          </div>
        </div>

        <div className="space-y-1.5 px-3">
          <button
            type="button"
            onClick={() => {
              close();
              setNewTaskOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg bg-ink px-2.5 py-2 text-[13px] font-semibold text-bg shadow-card transition-opacity hover:opacity-90"
          >
            <SquarePen className="size-3.5" />
            <span className="flex-1 text-left">Nouvelle tâche</span>
            <kbd className="rounded bg-bg/15 px-1.5 font-mono text-[10px] font-medium">C</kbd>
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              setPaletteOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-muted shadow-card transition-colors hover:border-line-strong hover:text-ink"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Rechercher, créer…</span>
            <Kbd>Ctrl K</Kbd>
          </button>
        </div>

        <nav className="mt-4 space-y-0.5 px-3" aria-label="Navigation principale">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={close}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                isActive(href) ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:bg-sunken",
              )}
            >
              <Icon className={cn("size-4", isActive(href) ? "text-accent" : "text-muted")} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 flex items-center justify-between px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">Projets</p>
          <button
            type="button"
            onClick={() => {
              close();
              setNewProjectOpen(true);
            }}
            aria-label="Nouveau projet"
            className="rounded p-0.5 text-muted hover:bg-sunken hover:text-ink"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto px-3 pb-3 scroll-thin">
          <ul className="space-y-0.5">
            {live.map((project) => (
              <ProjectLink key={project.id} project={project} active={pathname.startsWith(`/projects/${project.slug}`)} onNavigate={close} />
            ))}
            {projects.length === 0 && <li className="px-2.5 py-2 text-[12px] text-muted">Aucun projet pour l&apos;instant.</li>}
          </ul>

          {delivered.length > 0 && (
            <details className="group/delivered mt-3" open={deliveredActive || undefined}>
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint hover:text-muted [&::-webkit-details-marker]:hidden">
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
            <p className="truncate text-[13px] font-medium">{user.name}</p>
            <p className="truncate text-[11px] text-muted">{user.email}</p>
          </div>
          <Link href="/settings" onClick={close} aria-label="Paramètres" className="rounded p-1 text-muted hover:bg-sunken hover:text-ink">
            <Settings className="size-4" />
          </Link>
          <form action={logout}>
            <button type="submit" aria-label="Se déconnecter" className="rounded p-1 text-muted hover:bg-sunken hover:text-ink">
              <LogOut className="size-4" />
            </button>
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
          "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
          active ? "bg-surface font-medium text-ink shadow-card" : "text-ink-2 hover:bg-sunken",
        )}
      >
        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: project.color }} />
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
        {project.status === "WAITING_CLIENT" && (
          <span title={PROJECT_STATUS_BY_VALUE.WAITING_CLIENT.label} className="size-1.5 rounded-full bg-st-waiting" />
        )}
        {project._count.tasks > 0 && <span className="tabular text-[11px] text-faint">{project._count.tasks}</span>}
      </Link>
    </li>
  );
}
