import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { updateProjectNote } from "@/app/actions/projects";
import { ProjectNote } from "@/components/project-note";

vi.mock("@/app/actions/projects", () => ({ updateProjectNote: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function typeNote(text: string) {
  const user = userEvent.setup();
  render(<ProjectNote projectId="p1" note={null} noteAt={null} />);
  await user.click(screen.getByRole("button", { name: /Ajouter un point d/ }));
  await user.type(screen.getByLabelText("Point d'étape"), text);
  await user.click(screen.getByRole("button", { name: "Enregistrer" }));
}

describe("ProjectNote : succès avant confirmation (P1-08)", () => {
  it("échec : reste en édition avec le brouillon, affiche l'erreur, n'annonce aucun succès", async () => {
    vi.mocked(updateProjectNote).mockResolvedValue({ error: "Une erreur est survenue. Réessayez." });
    await typeNote("Attente du devis");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Une erreur est survenue. Réessayez."));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Point d'étape")).toHaveProperty("value", "Attente du devis");
  });

  it("succès : affiche la note enregistrée et annonce le succès", async () => {
    vi.mocked(updateProjectNote).mockResolvedValue({ ok: true });
    await typeNote("Attente du devis");

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(screen.queryByLabelText("Point d'étape")).toBeNull();
    expect(screen.getByText("Attente du devis")).toBeTruthy();
  });
});
