import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { quickAddTask } from "@/app/actions/tasks";
import { AppProvider } from "@/components/app-context";
import { QuickAdd } from "@/components/quick-add";

vi.mock("@/app/actions/tasks", () => ({ quickAddTask: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

function renderQuickAdd() {
  render(
    <AppProvider
      user={{ id: "u1", name: "Odo Klein", email: "odo@example.com", color: "#2B59F2", role: "ADMIN", mustChangePin: false }}
      team={[]}
      projects={[]}
      clients={[]}
    >
      <QuickAdd projectId="p1" projectSlug="bieres-georges" placeholder="Nouvelle tâche…" />
    </AppProvider>,
  );
  return screen.getByLabelText("Nouvelle tâche…") as HTMLInputElement;
}

describe("QuickAdd (P1-16)", () => {
  it("permet d’enchaîner 3 tâches sans attendre la réponse du serveur", async () => {
    const pending: ((value: { ok: true; ref: string; id: string }) => void)[] = [];
    vi.mocked(quickAddTask).mockImplementation(() => new Promise((resolve) => pending.push(resolve as never)));
    const input = renderQuickAdd();

    await userEvent.type(input, "Première{Enter}");
    expect(input.value).toBe("");
    expect(input.disabled).toBe(false);
    await userEvent.type(input, "Deuxième{Enter}");
    await userEvent.type(input, "Troisième{Enter}");

    expect(vi.mocked(quickAddTask).mock.calls.map((call) => call[1])).toEqual(["Première", "Deuxième", "Troisième"]);
    pending.forEach((resolve, i) => resolve({ ok: true, ref: `BG-${i + 1}`, id: `t${i}` }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(3));
    expect(vi.mocked(toast.success).mock.calls[0]).toEqual([
      "BG-1 créée",
      expect.objectContaining({ action: expect.objectContaining({ label: "Ouvrir" }) }),
    ]);
    expect(localStorage.getItem("last-project")).toBe("bieres-georges");
  });

  it("remet le texte dans le champ en cas d’échec", async () => {
    vi.mocked(quickAddTask).mockResolvedValue({ error: "Une erreur est survenue. Réessayez." });
    const input = renderQuickAdd();
    await userEvent.type(input, "Corriger le footer{Enter}");
    await waitFor(() => expect(input.value).toBe("Corriger le footer"));
    expect(toast.error).toHaveBeenCalled();
  });

  it("affiche « Ajoutez un titre » quand le titre est vide", async () => {
    const input = renderQuickAdd();
    await userEvent.type(input, "!haute{Enter}");
    expect(screen.getByRole("alert").textContent).toBe("Ajoutez un titre");
    expect(quickAddTask).not.toHaveBeenCalled();
    await userEvent.type(input, " titre");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
