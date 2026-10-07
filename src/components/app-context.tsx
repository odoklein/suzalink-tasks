"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { ClientOption, CurrentUser, ProjectNavItem, TeamMember } from "@/lib/dal";

type AppContextValue = {
  user: CurrentUser;
  team: TeamMember[];
  projects: ProjectNavItem[];
  clients: ClientOption[];
  openTaskId: string | null;
  openTask: (taskId: string) => void;
  closeTask: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  newProjectOpen: boolean;
  setNewProjectOpen: (open: boolean) => void;
  newTaskOpen: boolean;
  setNewTaskOpen: (open: boolean) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

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
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const openTask = useCallback((taskId: string) => setOpenTaskId(taskId), []);
  const closeTask = useCallback(() => setOpenTaskId(null), []);

  const value = useMemo(
    () => ({
      user,
      team,
      projects,
      clients,
      openTaskId,
      openTask,
      closeTask,
      paletteOpen,
      setPaletteOpen,
      newProjectOpen,
      setNewProjectOpen,
      newTaskOpen,
      setNewTaskOpen,
    }),
    [user, team, projects, clients, openTaskId, openTask, closeTask, paletteOpen, newProjectOpen, newTaskOpen],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp doit être utilisé dans <AppProvider>.");
  return value;
}
