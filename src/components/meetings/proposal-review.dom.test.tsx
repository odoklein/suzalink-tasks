import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { acceptMeetingProposals, ignoreMeetingProposal } from "@/app/actions/meetings";
import { AppProvider } from "@/components/app-context";
import { ProposalReview, type ProposalItem } from "@/components/meetings/proposal-review";

vi.mock("@/app/actions/meetings", () => ({
  acceptMeetingProposals: vi.fn(),
  ignoreMeetingProposal: vi.fn(),
  linkMeetingProposal: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const proposal = (over: Partial<ProposalItem>): ProposalItem => ({
  id: "p1",
  title: "Remplacer le visuel principal",
  description: null,
  basis: "REQUESTED",
  quote: "il faut le remplacer par la photo de l'équipe",
  segmentIndexes: [1],
  ownerText: null,
  suggestedUserId: null,
  dueText: null,
  suggestedDue: null,
  zone: "Homepage",
  status: "PENDING",
  task: null,
  duplicate: null,
  ...over,
});

const proposals = [
  proposal({}),
  proposal({
    id: "p2",
    title: "Envoyer une proposition de visuel",
    basis: "COMMITTED",
    quote: "je vous envoie une proposition jeudi",
    segmentIndexes: [2],
    ownerText: "Odo",
    suggestedUserId: "u1",
    dueText: "jeudi",
    suggestedDue: new Date("2026-10-14T22:00:00Z"),
    zone: null,
    duplicate: { ref: "BG-12", title: "Changer le visuel principal" },
  }),
  proposal({ id: "p3", title: "Revoir le pied de page", basis: "INFERRED", quote: "On pourrait aussi revoir le pied de page", segmentIndexes: [5] }),
  proposal({ id: "p4", title: "Créer une page Presse", status: "ACCEPTED", task: { ref: "BG-40", title: "Créer une page Presse" } }),
];

function renderReview(hasProject = true) {
  return render(
    <AppProvider
      user={{ id: "u1", name: "Odo Klein", email: "odo@example.com", color: "#2B59F2", role: "ADMIN", mustChangePin: false }}
      team={[
        { id: "u1", name: "Odo Klein", color: "#2B59F2" },
        { id: "u2", name: "Hichem", color: "#0E9F6E" },
      ]}
      projects={[]}
      clients={[]}
    >
      <ProposalReview
        meetingId="m1"
        hasProject={hasProject}
        proposals={proposals}
        segments={[
          { index: 1, speaker: "Luna Cervi", startMs: 4_000 },
          { index: 2, speaker: "Odo Klein", startMs: 252_000 },
          { index: 5, speaker: "Hichem", startMs: 30_000 },
        ]}
        zones={["Homepage", "À propos"]}
      />
    </AppProvider>,
  );
}

describe("Revue des actions proposées", () => {
  it("coche ce qui est demandé ou promis, pas ce qui est seulement déduit", () => {
    renderReview();
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.map((box) => box.checked)).toEqual([true, true, false]);
    expect(screen.getByRole("button", { name: "Créer les 2 tâches" })).toBeTruthy();
    expect(screen.getByText("Déduit, à confirmer")).toBeTruthy();
    // Preuve : la citation et le moment de la réunion.
    expect(screen.getByRole("link", { name: "04:12 · Odo Klein" }).getAttribute("href")).toBe("#s-2");
    expect(screen.getByText("BG-40 créée")).toBeTruthy();
  });

  it("n’a aucune violation axe", async () => {
    const { container } = renderReview();
    const results = await axe(container);
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it("envoie les actions choisies avec les modifications du manager", async () => {
    vi.mocked(acceptMeetingProposals).mockResolvedValue({ ok: true, refs: ["BG-41", "BG-42"] } as never);
    const user = userEvent.setup();
    renderReview();

    const title = screen.getAllByRole("textbox", { name: "Titre de la tâche" })[0];
    await user.clear(title);
    await user.type(title, "Remplacer le visuel par la photo d’équipe");
    await user.click(screen.getByRole("button", { name: "Créer les 2 tâches" }));

    await waitFor(() => expect(acceptMeetingProposals).toHaveBeenCalledTimes(1));
    expect(vi.mocked(acceptMeetingProposals).mock.calls[0]).toEqual([
      "m1",
      [
        { proposalId: "p1", title: "Remplacer le visuel par la photo d’équipe", assigneeId: null, dueDate: null, zone: "Homepage" },
        { proposalId: "p2", title: "Envoyer une proposition de visuel", assigneeId: "u1", dueDate: "2026-10-15", zone: null },
      ],
    ]);
  });

  it("ignore une action, et bloque la création sans projet", async () => {
    vi.mocked(ignoreMeetingProposal).mockResolvedValue({ ok: true } as never);
    const user = userEvent.setup();
    renderReview(false);
    expect((screen.getByRole("button", { name: "Créer les 2 tâches" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Associez d’abord la réunion à un projet pour créer les tâches.")).toBeTruthy();

    await user.click(screen.getAllByRole("button", { name: "Ignorer" })[2]);
    await waitFor(() => expect(ignoreMeetingProposal).toHaveBeenCalledWith("m1", "p3", true));
  });
});
