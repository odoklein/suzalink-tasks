import { describe, expect, it } from "vitest";

import { oldestWaitingDays, waitingDays, waitingLevel } from "@/lib/waiting";

describe("waitingDays", () => {
  it("compte en jours calendaires de Paris", () => {
    // 22 h 30 UTC le 8 = 0 h 30 le 9 à Paris : c’est déjà le lendemain.
    expect(waitingDays("2026-10-08T21:30:00Z", new Date("2026-10-08T22:30:00Z"))).toBe(1);
    expect(waitingDays("2026-10-08T08:00:00Z", new Date("2026-10-08T20:00:00Z"))).toBe(0);
  });

  it("traverse le passage à l’heure d’hiver sans décalage", () => {
    expect(waitingDays("2026-10-24T10:00:00Z", new Date("2026-10-26T10:00:00Z"))).toBe(2);
  });

  it("ne devient jamais négatif", () => {
    expect(waitingDays("2026-10-10T10:00:00Z", new Date("2026-10-08T10:00:00Z"))).toBe(0);
  });
});

describe("waitingLevel", () => {
  it("suit les seuils 0-2 / 3-4 / 5+", () => {
    expect([0, 2, 3, 4, 5, 9].map(waitingLevel)).toEqual(["calm", "calm", "watch", "watch", "chase", "chase"]);
  });
});

describe("oldestWaitingDays", () => {
  it("ne regarde que les tâches chez le client", () => {
    const now = new Date("2026-10-10T10:00:00Z");
    expect(
      oldestWaitingDays(
        [
          { status: "WAITING_CLIENT", statusChangedAt: "2026-10-07T10:00:00Z" },
          { status: "TODO", statusChangedAt: "2026-09-01T10:00:00Z" },
          { status: "WAITING_CLIENT", statusChangedAt: "2026-10-01T10:00:00Z" },
        ],
        now,
      ),
    ).toBe(9);
    expect(oldestWaitingDays([], now)).toBe(0);
  });
});
