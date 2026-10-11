import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { moveTask } from "@/app/actions/tasks";
import { Announcer } from "@/components/announcer";
import { AppProvider } from "@/components/app-context";
import { Board } from "@/components/board";
import type { TaskCard } from "@/lib/types";

vi.mock("@/app/actions/tasks", () => ({ moveTask: vi.fn(), quickAddTask: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/waiting-prompt", () => ({ promptWaitingFor: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const task = (over: Partial<TaskCard>): TaskCard =>
  ({
    id: "t1",
    number: 1,
    title: "Retirer l’ombre",
    status: "TODO",
    priority: "NONE",
    zone: null,
    source: null,
    billable: false,
    dueDate: null,
    position: 1000,
    completedAt: null,
    updatedAt: new Date("2026-10-01T10:00:00Z"),
    statusChangedAt: new Date("2026-10-01T10:00:00Z"),
    waitingSince: null,
    waitingFor: null,
    followUpAt: null,
    lastChasedAt: null,
    roundId: null,
    estimatedAmountCents: null,
    extraId: null,
    assigneeId: null,
    assignee: null,
    _count: { comments: 0 },
    ...over,
  }) as TaskCard;

function renderBoard(tasks: TaskCard[]) {
  return render(
    <AppProvider
      user={{ id: "u1", name: "Odo Klein", email: "odo@example.com", color: "#2B59F2", role: "ADMIN", mustChangePin: false }}
      team={[]}
      projects={[]}
      clients={[]}
    >
      <Announcer>
        <Board projectId="p1" projectKey="BG" tasks={tasks} />
      </Announcer>
    </AppProvider>,
  );
}

describe("Tableau : déplacer sans glisser (WCAG 2.5.7)", () => {
  it("chaque carte n’a qu’un bouton pour l’ouvrir, plus un menu « Déplacer vers… »", () => {
    renderBoard([task({})]);
    expect(screen.getByRole("button", { name: /Retirer l’ombre/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Déplacer BG-1 vers…" })).toBeTruthy();
  });

  it("n’a aucune violation axe", async () => {
    const { container } = renderBoard([task({}), task({ id: "t2", number: 2, status: "WAITING_CLIENT", title: "Valider la maquette" })]);
    const results = await axe(container);
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it("déplace la carte, l’enregistre et l’annonce aux lecteurs d’écran", async () => {
    vi.mocked(moveTask).mockResolvedValue({ ok: true } as never);
    renderBoard([task({})]);

    await userEvent.click(screen.getByRole("button", { name: "Déplacer BG-1 vers…" }));
    const menu = await screen.findByRole("menu", { name: "Déplacer BG-1" });
    expect(within(menu).queryByRole("menuitem", { name: "À faire" })).toBeNull(); // la colonne actuelle n’est pas proposée
    await userEvent.click(within(menu).getByRole("menuitem", { name: "En cours" }));

    expect(moveTask).toHaveBeenCalledWith("t1", "IN_PROGRESS", expect.any(Number));
    await waitFor(() => expect(document.querySelector('[aria-live="polite"]')?.textContent).toContain("BG-1 déplacée dans « En cours »."));
  });
});
