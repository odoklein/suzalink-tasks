import { AppProvider } from "@/components/app-context";
import { CommandPalette } from "@/components/command-palette";
import { NewProjectDialog } from "@/components/project-dialogs";
import { Sidebar } from "@/components/sidebar";
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
      <div className="flex h-dvh overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
      <TaskDrawer />
      <CommandPalette />
      <NewProjectDialog />
    </AppProvider>
  );
}
