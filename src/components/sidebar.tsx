"use client";

import { Building2, CalendarCheck2, FolderKanban, LogOut, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/app/actions/auth";
import { useApp } from "@/components/app-context";
import { Avatar, Kbd } from "@/components/primitives";
import { PROJECT_STATUS_BY_VALUE } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Aujourd'hui", icon: CalendarCheck2 },
  { href: "/projects", label: "Projets", icon: FolderKanban },
  { href: "/clients", label: "Clients", icon: Building2 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, projects, setPaletteOpen, setNewProjectOpen } = useApp();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-surface-2">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
        <span className="flex size-7 items-center justify-center rounded-lg bg-ink font-display text-[13px] font-bold text-bg">
          S
        </span>
        <div className="leading-tight">
          <p className="font-display text-[14px] font-semibold tracking-tight">Suzali Tasks</p>
          <p className="text-[11px] text-muted">Suzali Conseil</p>
        </div>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
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
          onClick={() => setNewProjectOpen(true)}
          aria-label="Nouveau projet"
          className="rounded p-0.5 text-muted hover:bg-sunken hover:text-ink"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <ul className="mt-1.5 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3 scroll-thin">
        {projects.map((project) => {
          const href = `/projects/${project.slug}`;
          const active = pathname.startsWith(href);
          return (
            <li key={project.id}>
              <Link
                href={href}
                className={cn(
                  "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  active ? "bg-surface font-medium text-ink shadow-card" : "text-ink-2 hover:bg-sunken",
                )}
              >
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: project.color }} />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                {project.status === "WAITING_CLIENT" && (
                  <span
                    title={PROJECT_STATUS_BY_VALUE.WAITING_CLIENT.label}
                    className="size-1.5 rounded-full bg-st-waiting"
                  />
                )}
                {project._count.tasks > 0 && (
                  <span className="tabular text-[11px] text-faint">{project._count.tasks}</span>
                )}
              </Link>
            </li>
          );
        })}
        {projects.length === 0 && (
          <li className="px-2.5 py-2 text-[12px] text-muted">Aucun projet pour l&apos;instant.</li>
        )}
      </ul>

      <div className="flex items-center gap-2.5 border-t border-line px-4 py-3">
        <Avatar name={user.name} color={user.color} size={26} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-medium">{user.name}</p>
          <p className="truncate text-[11px] text-muted">{user.email}</p>
        </div>
        <Link href="/settings" aria-label="Paramètres" className="rounded p-1 text-muted hover:bg-sunken hover:text-ink">
          <Settings className="size-4" />
        </Link>
        <form action={logout}>
          <button type="submit" aria-label="Se déconnecter" className="rounded p-1 text-muted hover:bg-sunken hover:text-ink">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </aside>
  );
}
