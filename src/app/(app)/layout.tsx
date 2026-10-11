import { Announcer } from "@/components/announcer";
import { AppProvider } from "@/components/app-context";
import { CommandPalette } from "@/components/command-palette";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { PinChangeGate } from "@/components/pin-change-gate";
import { NewProjectDialog } from "@/components/project-dialogs";
import { MobileBar, Sidebar } from "@/components/sidebar";
import { TaskDrawer } from "@/components/task-drawer";
import { WaitingPrompt } from "@/components/waiting-prompt";
import { getClients, getCurrentUser, getProjectsNav, getTeam } from "@/lib/dal";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, team, projects, clients] = await Promise.all([
    getCurrentUser(),
    getTeam(),
    getProjectsNav(),
    getClients(),
  ]);

  return (
    <AppProvider user={user} team={team} projects={projects} clients={clients}>
      <Announcer>
        {/* Premier élément focusable : un clavier saute le menu et arrive directement au contenu. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-toast focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-ui focus:font-medium focus:shadow-pop"
        >
          Aller au contenu
        </a>
        {/* Coque : la barre latérale repose sur --chrome, le contenu dans un panneau arrondi et bordé. */}
        <div className="flex h-dvh flex-col overflow-hidden bg-chrome md:flex-row">
          <MobileBar />
          <Sidebar />
          <main
            id="main"
            tabIndex={-1}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg outline-hidden md:my-2 md:mr-2 md:rounded-2xl md:border md:border-line md:shadow-card"
          >
            {user.mustChangePin ? <PinChangeGate>{children}</PinChangeGate> : children}
          </main>
        </div>
        <TaskDrawer />
        <CommandPalette />
        <NewProjectDialog />
        <NewTaskDialog />
        <WaitingPrompt />
      </Announcer>
    </AppProvider>
  );
}
