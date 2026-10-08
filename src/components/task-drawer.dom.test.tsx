import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getTaskDetail, updateTask } from "@/app/actions/tasks";
import { AppProvider, useApp } from "@/components/app-context";
import { TaskDrawer } from "@/components/task-drawer";

vi.mock("@/app/actions/tasks", () => ({
  getTaskDetail: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  addComment: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const detail = {
  id: "t1",
  number: 7,
  title: "Titre",
  description: null,
  status: "TODO",
  priority: "NONE",
  zone: null,
  source: null,
  billable: false,
  assigneeId: null,
  dueDate: null,
  createdAt: new Date("2026-10-01T10:00:00Z"),
  project: { id: "p1", key: "BG", name: "Bières Georges", slug: "bieres-georges", color: "#2B59F2" },
  creator: { name: "Odo Klein" },
  comments: [],
  activities: [],
};

function Opener() {
  const { openTask } = useApp();
  return (
    <button type="button" onClick={() => openTask("t1")}>
      ouvrir
    </button>
  );
}

function renderDrawer() {
  return render(
    <AppProvider
      user={{ id: "u1", name: "Odo Klein", email: "odo@example.com", color: "#2B59F2", role: "ADMIN" }}
      team={[]}
      projects={[]}
      clients={[]}
    >
      <Opener />
      <TaskDrawer />
    </AppProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(getTaskDetail).mockResolvedValue(detail as never);
  vi.mocked(updateTask).mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TaskDrawer : brouillons (P1-04)", () => {
  it("enregistre le titre tapé quand on ferme avec Échap, sans blur préalable", async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByText("ouvrir"));
    const title = await screen.findByLabelText("Titre de la tâche");
    await user.type(title, " modifié");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("t1", { title: "Titre modifié" }));
    expect(screen.queryByLabelText("Titre de la tâche")).toBeNull();
  });

  it("enregistre la description tapée quand on ferme par le bouton X", async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByText("ouvrir"));
    const description = await screen.findByLabelText("Description");
    await user.type(description, "Le détail");
    await user.click(screen.getByLabelText("Fermer"));

    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("t1", { description: "Le détail" }));
  });

  it("n'envoie rien quand rien n'a changé", async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByText("ouvrir"));
    await screen.findByLabelText("Titre de la tâche");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByLabelText("Titre de la tâche")).toBeNull());
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("restaure le commentaire non envoyé à la réouverture", async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByText("ouvrir"));
    await user.type(await screen.findByLabelText("Nouveau commentaire"), "À relire demain");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByLabelText("Nouveau commentaire")).toBeNull());

    expect(sessionStorage.getItem("draft-comment:t1")).toBe("À relire demain");
    await user.click(screen.getByText("ouvrir"));
    expect(await screen.findByLabelText("Nouveau commentaire")).toHaveProperty("value", "À relire demain");
  });
});
