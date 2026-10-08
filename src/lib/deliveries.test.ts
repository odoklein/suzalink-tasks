import { describe, expect, it } from "vitest";

import { deliveryCandidates, roundsToClose, suggestDeliveryTitle, type CandidateTask } from "@/lib/deliveries";

const t = (id: string, status: CandidateTask["status"], completedAt: string | null = null, zone: string | null = null, roundId: string | null = null) => ({
  id,
  status,
  completedAt: completedAt ? new Date(completedAt) : null,
  zone,
  roundId,
});

describe("deliveryCandidates", () => {
  const tasks = [
    t("a", "DONE", "2026-10-01T10:00:00Z"),
    t("b", "DONE", "2026-10-06T10:00:00Z"),
    t("c", "REVIEW"),
    t("d", "TODO"),
    t("e", "WAITING_CLIENT"),
  ];
  it("propose les « À valider » et le fait depuis la mise en ligne précédente", () => {
    expect(deliveryCandidates(tasks, new Date("2026-10-05T00:00:00Z")).map((x) => x.id)).toEqual(["b", "c"]);
  });
  it("propose tout le fait pour une première mise en ligne", () => {
    expect(deliveryCandidates(tasks, null).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
});

describe("suggestDeliveryTitle", () => {
  it("liste les pages concernées, sans doublon", () => {
    expect(suggestDeliveryTitle(["Homepage", "Fiche produit", "Homepage", null])).toBe("Corrections Homepage, Fiche produit");
  });
  it("résume au-delà de trois pages", () => {
    expect(suggestDeliveryTitle(["A", "B", "C", "D", "E"])).toBe("Corrections A, B et 3 autres pages");
  });
  it("sans page", () => {
    expect(suggestDeliveryTitle([])).toBe("Corrections");
  });
});

describe("roundsToClose", () => {
  const rounds = [
    { id: "r1", status: "OPEN" as const },
    { id: "r2", status: "OPEN" as const },
    { id: "r3", status: "CLOSED" as const },
  ];
  const tasks = [t("a", "DONE", null, null, "r1"), t("b", "REVIEW", null, null, "r1"), t("c", "TODO", null, null, "r2")];
  it("coche un lot quand toutes ses tâches seront faites", () => {
    expect(roundsToClose(rounds, tasks, new Set())).toEqual([
      { id: "r1", complete: false },
      { id: "r2", complete: false },
    ]);
    expect(roundsToClose(rounds, tasks, new Set(["b"]))[0]).toEqual({ id: "r1", complete: true });
  });
});
