import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    <>
      <button type="button" onClick={() => openTask("t1")}>
        ouvrir
      </button>
      <button type="button" onClick={() => openTask("t2")}>
        ouvrir 2
      </button>
    </>
  );
}

function renderDrawer() {
  return render(
    <AppProvider
      user={{ id: "u1", name: "Odo Klein", email: "odo@example.com", color: "#2B59F2", role: "ADMIN", mustChangePin: false }}
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

describe("TaskDrawer : états de chargement (P1-09)", () => {
  it("affiche « Cette tâche a été supprimée. » (et non un squelette sans fin) quand la tâche n'existe plus", async () => {
    vi.mocked(getTaskDetail).mockResolvedValue(null);
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByText("ouvrir"));

    expect(await screen.findByText("Cette tâche a été supprimée.")).toBeTruthy();
    expect(screen.queryByText("Réessayer")).toBeNull();
    await user.click(screen.getAllByRole("button", { name: "Fermer" }).at(-1)!);
    expect(screen.queryByText("Cette tâche a été supprimée.")).toBeNull();
  });

  it("propose « Réessayer » après une erreur de chargement, puis affiche la tâche", async () => {
    vi.mocked(getTaskDetail)
      .mockResolvedValueOnce({ error: "Une erreur est survenue. Réessayez." })
      .mockResolvedValueOnce(detail as never);
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByText("ouvrir"));

    await user.click(await screen.findByRole("button", { name: "Réessayer" }));
    expect(await screen.findByLabelText("Titre de la tâche")).toHaveProperty("value", "Titre");
    expect(getTaskDetail).toHaveBeenCalledTimes(2);
  });

  it("traite un rejet réseau comme une erreur de chargement", async () => {
    vi.mocked(getTaskDetail).mockRejectedValueOnce(new Error("réseau"));
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByText("ouvrir"));
    expect(await screen.findByText("Impossible de charger la tâche.")).toBeTruthy();
  });

  it("ignore une réponse tardive d'une tâche précédente", async () => {
    let resolveFirst: (value: never) => void = () => {};
    vi.mocked(getTaskDetail)
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve as never)))
      .mockResolvedValueOnce({ ...detail, id: "t2", title: "Deuxième" } as never);
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByText("ouvrir"));
    await user.click(screen.getByText("ouvrir 2"));
    expect(await screen.findByDisplayValue("Deuxième")).toBeTruthy();

    // la réponse de t1 arrive après : elle ne doit ni écraser t2 ni bloquer le tiroir
    resolveFirst({ ...detail, title: "Première" } as never);
    await Promise.resolve();
    expect(screen.queryByDisplayValue("Première")).toBeNull();
    expect(screen.getByDisplayValue("Deuxième")).toBeTruthy();
  });
});

describe("TaskDrawer : échéance (P1-18)", () => {
  it("n'enregistre qu'au blur, et ignore une année avant 2000", async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByText("ouvrir"));
    const due = (await screen.findByLabelText("Échéance")) as HTMLInputElement;

    fireEvent.change(due, { target: { value: "0202-10-12" } });
    fireEvent.blur(due);
    expect(updateTask).not.toHaveBeenCalled();
    expect(due.value).toBe("");

    fireEvent.change(due, { target: { value: "2026-10-12" } });
    expect(updateTask).not.toHaveBeenCalled();
    fireEvent.blur(due);
    await waitFor(() => expect(updateTask).toHaveBeenCalledWith("t1", { dueDate: "2026-10-12" }));
    expect(updateTask).toHaveBeenCalledTimes(1);
  });
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
