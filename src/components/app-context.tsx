"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { resolveTaskRef } from "@/app/actions/task-links";
import type { ClientOption, CurrentUser, ProjectNavItem, TeamMember } from "@/lib/dal";

/** Paramètre d’URL qui porte la tâche ouverte : ?tache=BG-12. */
export const TASK_PARAM = "tache";

type AppContextValue = {
  user: CurrentUser;
  team: TeamMember[];
  projects: ProjectNavItem[];
  clients: ClientOption[];
  openTaskId: string | null;
  /** Valeur de ?tache= (BG-12, ou un id) : présente dès l’ouverture, avant même la résolution. */
  openTaskRef: string | null;
  /** Ouvre le tiroir ; `ref` (BG-12) donne une URL lisible, sinon l’id sert de clé. */
  openTask: (taskId: string, ref?: string) => void;
  closeTask: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  newProjectOpen: boolean;
  setNewProjectOpen: (open: boolean) => void;
  newTaskOpen: boolean;
  setNewTaskOpen: (open: boolean) => void;
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function urlWith(param: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (param) params.set(TASK_PARAM, param);
  else params.delete(TASK_PARAM);
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
}

export function AppProvider({
  user,
  team,
  projects,
  clients,
  children,
}: {
  user: CurrentUser;
  team: TeamMember[];
  projects: ProjectNavItem[];
  clients: ClientOption[];
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlParam = searchParams?.get(TASK_PARAM) ?? null;
  const [localParam, setLocalParam] = useState<{ forUrl: string | null; value: string | null }>({
    forUrl: urlParam,
    value: urlParam,
  });

  const param = localParam.forUrl === urlParam ? localParam.value : urlParam;

  // Correspondance référence → id : remplie à l’ouverture depuis l’application, sinon par
  // une recherche serveur (lien collé, page rechargée).
  const [known, setKnown] = useState<Record<string, string>>({});
  // Vrai quand le tiroir a été ouvert ici : la fermeture fait alors « Précédent ».
  const openedInApp = useRef(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const openTaskId = param ? (known[param] ?? (param.includes("-") ? null : param)) : null;

  useEffect(() => {
    if (!param || known[param]) return;
    let cancelled = false;
    resolveTaskRef(param)
      .then((found) => {
        if (cancelled) return;
        // Introuvable : on retire le paramètre plutôt que d’afficher un tiroir vide.
        if (found) setKnown((current) => ({ ...current, [param]: found.id }));
        else if (typeof window !== "undefined") window.history.replaceState(null, "", urlWith(null));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [param, known]);

  // Une navigation vers une autre page n’est pas une ouverture « dans l’application ».
  useEffect(() => {
    openedInApp.current = false;
  }, [pathname]);

  const openTask = useCallback(
    (taskId: string, ref?: string) => {
      const key = ref ?? taskId;
      setKnown((current) => ({ ...current, [key]: taskId }));
      setLocalParam({ forUrl: urlParam, value: key });
      if (typeof window !== "undefined") {
        const alreadyOpen = new URLSearchParams(window.location.search).has(TASK_PARAM);
        // Passer d’une tâche à l’autre remplace l’entrée : « Précédent » ferme le tiroir.
        if (alreadyOpen) window.history.replaceState(null, "", urlWith(key));
        else window.history.pushState(null, "", urlWith(key));
      }
      openedInApp.current = true;
    },
    [urlParam],
  );

  const closeTask = useCallback(() => {
    setLocalParam({ forUrl: urlParam, value: null });
    if (typeof window !== "undefined") {
      if (!new URLSearchParams(window.location.search).has(TASK_PARAM)) return;
      if (openedInApp.current) {
        openedInApp.current = false;
        window.history.back();
      } else {
        window.history.replaceState(null, "", urlWith(null));
      }
    }
  }, [urlParam]);

  const value = useMemo(
    () => ({
      user,
      team,
      projects,
      clients,
      openTaskId,
      openTaskRef: param,
      openTask,
      closeTask,
      paletteOpen,
      setPaletteOpen,
      newProjectOpen,
      setNewProjectOpen,
      newTaskOpen,
      setNewTaskOpen,
      navOpen,
      setNavOpen,
    }),
    [user, team, projects, clients, openTaskId, param, openTask, closeTask, paletteOpen, newProjectOpen, newTaskOpen, navOpen],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp doit être utilisé dans <AppProvider>.");
  return value;
}
