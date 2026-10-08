import { describe, expect, it } from "vitest";

import { backoffDelayMinutes, nextRunAfterFailure, recurringJobs } from "@/lib/jobs/schedule";

describe("backoff", () => {
  it("double à chaque tentative", () => {
    expect([1, 2, 3, 4, 5, 6].map(backoffDelayMinutes)).toEqual([2, 4, 8, 16, 32, 64]);
  });
  it("calcule la prochaine exécution", () => {
    expect(nextRunAfterFailure(new Date("2026-10-08T10:00:00Z"), 3).toISOString()).toBe("2026-10-08T10:08:00.000Z");
  });
});

describe("recurringJobs", () => {
  it("donne des clés par minute, jour et semaine (heure de Paris)", () => {
    // 23 h 30 UTC le 8 = 1 h 30 à Paris le 9 octobre 2026 (un vendredi).
    const jobs = recurringJobs(new Date("2026-10-08T23:30:00Z"));
    expect(jobs.map((job) => job.dedupeKey)).toEqual(["dispatch:2026-10-09T01:30", "daily:2026-10-09", "digest:2026-W41"]);
    expect(jobs[1].runAt.toISOString()).toBe("2026-10-09T04:00:00.000Z");
    // Lundi 5 octobre 8 h à Paris = 6 h UTC.
    expect(jobs[2].runAt.toISOString()).toBe("2026-10-05T06:00:00.000Z");
  });
  it("suit le changement d'heure", () => {
    const jobs = recurringJobs(new Date("2026-10-26T12:00:00Z"));
    expect(jobs[1].runAt.toISOString()).toBe("2026-10-26T05:00:00.000Z");
  });
});
