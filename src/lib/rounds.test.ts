import { describe, expect, it } from "vitest";

import { groupLegacyRounds, roundCounts } from "@/lib/rounds";

describe("roundCounts", () => {
  it("chaque tâche compte dans exactement une case", () => {
    const counts = roundCounts([
      { status: "DONE" },
      { status: "DONE" },
      { status: "WAITING_CLIENT" },
      { status: "TODO" },
      { status: "IN_PROGRESS" },
      { status: "REVIEW" },
    ]);
    expect(counts).toEqual({ total: 6, done: 2, waiting: 1, remaining: 3 });
    expect(counts.done + counts.waiting + counts.remaining).toBe(counts.total);
  });

  it("un lot vide compte zéro", () => {
    expect(roundCounts([])).toEqual({ total: 0, done: 0, waiting: 0, remaining: 0 });
  });
});

describe("groupLegacyRounds", () => {
  const t = (id: string, projectId: string, source: string | null, day: number, status: "DONE" | "TODO" = "TODO") => ({
    id,
    projectId,
    source,
    createdAt: new Date(Date.UTC(2026, 9, day)),
    status,
  });

  it("regroupe par projet et par source, ignore les tâches sans source", () => {
    const rounds = groupLegacyRounds([
      t("a", "p1", "Retours Luna 06/10", 6, "DONE"),
      t("b", "p1", "Retours Luna 06/10", 5, "DONE"),
      t("c", "p1", "Appel client", 7),
      t("d", "p2", "Retours Luna 06/10", 8),
      t("e", "p1", null, 9),
    ]);
    expect(rounds).toHaveLength(3);
    const luna = rounds.find((r) => r.projectId === "p1" && r.label === "Retours Luna 06/10")!;
    expect(luna.taskIds).toEqual(["a", "b"]);
    expect(luna.receivedAt.toISOString()).toBe("2026-10-05T00:00:00.000Z");
    expect(luna.status).toBe("CLOSED");
    expect(luna.channel).toBe("SHEETS");
    const call = rounds.find((r) => r.label === "Appel client")!;
    expect(call.status).toBe("OPEN");
    expect(call.channel).toBe("WEB");
  });
});
