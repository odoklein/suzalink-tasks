import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { quickAddTask } from "@/app/actions/tasks";
import { AppProvider } from "@/components/app-context";
import { CommandPalette } from "@/components/command-palette";

const router = vi.hoisted(() => ({ push: vi.fn(), pathname: "/" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: router.push }),
  usePathname: () => router.pathname,
}));
vi.mock("@/app/actions/tasks", () => ({ quickAddTask: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeAll(() => {
  // cmdk s'appuie sur ces API absentes de happy-dom
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

const project = (id: string, name: string, slug: string, key: string, status = "ACTIVE") => ({
  id,
  name,
  slug,
  key,
  color: "#2B59F2",
  status: status as "ACTIVE",
  _count: { tasks: 3 },
});

function renderPalette() {
  render(
    <AppProvider
      user={{ id: "u1", name: "Odo Klein", email: "odo@example.com", color: "#2B59F2", role: "ADMIN", mustChangePin: false }}
      team={[]}
      projects={[
        project("p1", "Archives", "archives", "AR", "DONE"),
        project("p2", "Bières Georges", "bieres-georges", "BG"),
        project("p3", "Crésus Paie", "cresus-paie", "CP"),
      ]}
      clients={[]}
    >
      <CommandPalette />
    </AppProvider>,
  );
  fireEvent.keyDown(document, { key: "k", ctrlKey: true });
}

describe("CommandPalette (P1-15)", () => {
  it("« Bièr » puis Entrée va sur Bières Georges, sans créer de tâche", async () => {
    renderPalette();
    await userEvent.type(screen.getByRole("combobox"), "Bièr{Enter}");
    expect(router.push).toHaveBeenCalledWith("/projects/bieres-georges");
    expect(quickAddTask).not.toHaveBeenCalled();
  });

  it("« + titre » passe en mode création, avec les projets actifs seulement", async () => {
    renderPalette();
    await userEvent.type(screen.getByRole("combobox"), "+Corriger le footer");
    expect(screen.getByText("Créer « Corriger le footer » dans")).toBeTruthy();
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["BGBières Georges", "CPCrésus Paie"]);

    vi.mocked(quickAddTask).mockResolvedValue({ ok: true, ref: "BG-15", id: "t15" });
    await userEvent.keyboard("{Enter}");
    expect(quickAddTask).toHaveBeenCalledWith("p2", "Corriger le footer");
    expect(localStorage.getItem("last-project")).toBe("bieres-georges");
  });

  it("propose d’abord le dernier projet utilisé", async () => {
    localStorage.setItem("last-project", "cresus-paie");
    renderPalette();
    await userEvent.type(screen.getByRole("combobox"), "+Relance");
    expect(screen.getAllByRole("option")[0].textContent).toContain("Crésus Paie");
  });
});
