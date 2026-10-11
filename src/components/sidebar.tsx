"use client";

import { Building2, CalendarCheck2, ChevronRight, ChevronsUpDown, Euro, FolderKanban, LogOut, Mail, Menu, Plus, Search, Settings, SquarePen, Video } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { logout } from "@/app/actions/auth";
import { useApp } from "@/components/app-context";
import { useOpenNewTask } from "@/components/new-task-dialog";
import { Avatar, ProjectTile } from "@/components/primitives";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button, IconButton } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { PROJECT_STATUS_BY_VALUE } from "@/lib/constants";
import type { ProjectNavItem } from "@/lib/dal";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Aujourd’hui", icon: CalendarCheck2 },
  { href: "/projects", label: "Projets", icon: FolderKanban },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/reunions", label: "Réunions", icon: Video },
  { href: "/courriels", label: "E-mails", icon: Mail },
  { href: "/facturation", label: "Facturation", icon: Euro },
];

/** Lien du menu : pilule blanche quand la page est ouverte, gris discret au survol sinon. */
const navItem = "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-body transition-colors pointer-coarse:min-h-11";
const navActive = "bg-surface font-medium text-ink shadow-card";
const navIdle = "text-ink-2 hover:bg-surface/70 hover:text-ink";

function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-md bg-ink text-body font-bold text-bg shadow-button"
    >
      S
    </span>
  );
}

/** Barre du haut sur téléphone : la barre latérale s'ouvre en tiroir. */
export function MobileBar() {
  const { setNavOpen, setPaletteOpen } = useApp();
  const openNewTask = useOpenNewTask();
  return (
    <header className="flex shrink-0 items-center gap-1.5 border-b border-line bg-chrome px-2 py-2 md:hidden">
      <IconButton label="Ouvrir le menu" onClick={() => setNavOpen(true)}>
        <Menu className="size-4" />
      </IconButton>
      <Logo size={24} />
      <span className="text-body font-semibold tracking-title">Suzali Tasks</span>
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
  const router = useRouter();
  const { user, projects, setPaletteOpen, setNewProjectOpen, navOpen, setNavOpen } = useApp();
  const openNewTask = useOpenNewTask();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const close = () => setNavOpen(false);

  // Téléphone : Échap ferme le tiroir, comme un toucher sur le voile.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen, setNavOpen]);

  const live = projects.filter((project) => project.status !== "DONE");
  const delivered = projects.filter((project) => project.status === "DONE");
  const deliveredActive = delivered.some((project) => pathname.startsWith(`/projects/${project.slug}`));

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-sidebar bg-[var(--scrim)] transition-opacity duration-[var(--dur-2)] md:hidden",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        aria-label="Menu"
        className={cn(
          "flex h-full w-[280px] shrink-0 flex-col bg-chrome",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-sidebar max-md:border-r max-md:border-line max-md:shadow-pop",
          // Ouvert : arrivée posée. Fermé : sortie plus rapide, et `visibility` attend la fin du glissement
          // (sans cela le panneau disparaissait d’un coup, sans qu’on voie la sortie).
          navOpen
            ? "max-md:translate-x-0 max-md:[transition:transform_var(--dur-3)_var(--ease-out),visibility_0s]"
            : "max-md:invisible max-md:-translate-x-full max-md:[transition:transform_var(--dur-2)_var(--ease-in),visibility_0s_linear_var(--dur-2)]",
          "md:w-[var(--sidebar-w)]",
        )}
      >
        <div className="flex items-center gap-3 px-4 pb-4 pt-5">
          <Logo />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-body font-semibold tracking-title">Suzali Tasks</p>
            <p className="truncate text-xs text-muted">Suzali Conseil</p>
          </div>
        </div>

        <div className="px-3">
          {/* Champ de recherche d’aspect, bouton de fait : il ouvre la palette (Ctrl K). */}
          <button
            type="button"
            onClick={() => {
              close();
              setPaletteOpen(true);
            }}
            className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-ui text-muted shadow-xs outline-hidden transition-colors hover:border-line-strong hover:text-ink-2 focus-visible:shadow-[var(--ring)] pointer-coarse:min-h-11"
          >
            <Search className="size-4 shrink-0" />
            <span className="flex-1 text-left">Rechercher, créer…</span>
            <Kbd keys="Mod+K" />
          </button>
        </div>

        <p className="mt-5 px-5 text-xs font-medium text-muted">Menu principal</p>
        <nav className="mt-1.5 space-y-0.5 px-3" aria-label="Navigation principale">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={close}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(navItem, isActive(href) ? navActive : navIdle)}
            >
              <PendingMark>
                <Icon className={cn("size-[18px]", isActive(href) ? "text-ink" : "text-muted")} />
              </PendingMark>
              {label}
            </Link>
          ))}
        </nav>

        <div aria-hidden="true" className="mx-5 mt-4 border-t border-line" />

        <div className="mt-3 flex items-center justify-between pl-5 pr-3">
          <p className="text-xs font-medium text-muted">Projets</p>
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

        <div className="mt-1 min-h-0 flex-1 overflow-y-auto px-3 pb-3 scroll-thin">
          <ul className="space-y-0.5">
            {live.map((project) => (
              <ProjectLink key={project.id} project={project} active={pathname.startsWith(`/projects/${project.slug}`)} onNavigate={close} />
            ))}
            {projects.length === 0 && <li className="px-2.5 py-2 text-xs text-muted">Aucun projet pour l’instant.</li>}
          </ul>

          {delivered.length > 0 && (
            <details className="group/delivered mt-3" open={deliveredActive || undefined}>
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium text-muted hover:text-ink-2 [&::-webkit-details-marker]:hidden">
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

        {/* Carte d’action : l’ajout de tâche reste à portée, quelle que soit la longueur de la liste. */}
        <div className="mx-3 rounded-lg border border-line bg-surface p-3.5 shadow-card">
          <div className="[@media(max-height:760px)]:hidden">
            <p className="text-ui font-semibold">Une nouvelle demande ?</p>
            <p className="mt-0.5 text-xs text-muted">Créez une tâche, ou collez un tableau de retours depuis un projet.</p>
          </div>
          <Button
            variant="primary"
            icon={<SquarePen className="size-4" />}
            onClick={() => {
              close();
              openNewTask();
            }}
            className="mt-3 w-full [@media(max-height:760px)]:mt-0"
          >
            <span className="flex-1 text-left">Nouvelle tâche</span>
            <Kbd onInk>C</Kbd>
          </Button>
        </div>

        <div className="p-3">
          <ActionMenu
            label="Compte"
            align="start"
            className="min-w-56"
            items={[
              {
                label: "Paramètres",
                icon: <Settings />,
                onSelect: () => {
                  close();
                  router.push("/settings");
                },
              },
              { label: "Se déconnecter", icon: <LogOut />, onSelect: () => void logout() },
            ]}
            trigger={(props) => (
              <button
                {...props}
                type="button"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-hidden transition-colors hover:bg-surface/70 focus-visible:shadow-[var(--ring)] pointer-coarse:min-h-11",
                  pathname.startsWith("/settings") && "bg-surface shadow-card",
                )}
              >
                <Avatar name={user.name} color={user.color} size={32} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-ui font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted">{user.email}</span>
                </span>
                <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
              </button>
            )}
          />
        </div>
      </aside>
    </>
  );
}

/**
 * Dans un <Link> : l’icône (ou la pastille) bat doucement tant que la navigation n’a pas abouti,
 * après 150 ms. Les routes ont un `loading.tsx` ; ceci couvre le cas où la page cible n’est pas
 * encore préchargée. Aucun décalage de mise en page : le repère existe déjà.
 */
function PendingMark({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span data-pending={pending || undefined} className="flex shrink-0 data-[pending]:animate-pulse data-[pending]:[animation-delay:150ms]">
      {children}
    </span>
  );
}

function ProjectLink({ project, active, onNavigate }: { project: ProjectNavItem; active: boolean; onNavigate: () => void }) {
  return (
    <li>
      <Link
        href={`/projects/${project.slug}`}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(navItem, "group py-1.5 text-ui", active ? navActive : navIdle)}
      >
        <PendingMark>
          <ProjectTile color={project.color} label={project.key} size={22} />
        </PendingMark>
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
        {project.status === "WAITING_CLIENT" && (
          <>
            <Tooltip content={PROJECT_STATUS_BY_VALUE.WAITING_CLIENT.label}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-waiting" />
            </Tooltip>
            <span className="sr-only">{PROJECT_STATUS_BY_VALUE.WAITING_CLIENT.label}</span>
          </>
        )}
        {project._count.tasks > 0 && <span className="tabular text-xs text-muted">{project._count.tasks}</span>}
      </Link>
    </li>
  );
}
