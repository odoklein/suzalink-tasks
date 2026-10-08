import { AppProvider } from "@/components/app-context";
import { CommandPalette } from "@/components/command-palette";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { PinChangeGate } from "@/components/pin-change-gate";
import { NewProjectDialog } from "@/components/project-dialogs";
import { MobileBar, Sidebar } from "@/components/sidebar";
import { TaskDrawer } from "@/components/task-drawer";
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
      <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
        <MobileBar />
        <Sidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {user.mustChangePin ? <PinChangeGate>{children}</PinChangeGate> : children}
        </main>
      </div>
      <TaskDrawer />
      <CommandPalette />
      <NewProjectDialog />
      <NewTaskDialog />
    </AppProvider>
  );
}
