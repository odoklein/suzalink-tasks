import { describe, expect, it } from "vitest";

import { calendarSyncKey, dispatchKey, pollKey, watchKey } from "@/lib/meetings/job-kinds";
import { captureStatusFrom, isLive } from "@/lib/meetings/vexa-status";

describe("captureStatusFrom", () => {
  it("suit le robot jusqu'à la salle et pendant la réunion", () => {
    expect(captureStatusFrom({ status: "requested" })).toEqual({ status: "JOINING", error: null });
    expect(captureStatusFrom({ status: "awaiting_admission" })?.status).toBe("WAITING_ADMISSION");
    expect(captureStatusFrom({ status: "active" })?.status).toBe("RECORDING");
    expect(captureStatusFrom({ status: "needs_human_help" })?.status).toBe("RECORDING");
    expect(captureStatusFrom({ status: "stopping" })?.status).toBe("RECORDING");
  });

  it("distingue une fin normale d'un échec, avec la raison en français", () => {
    expect(captureStatusFrom({ status: "completed", completion_reason: "left_alone" })).toEqual({ status: "ENDED", error: null });
    expect(captureStatusFrom({ status: "completed", completion_reason: "evicted" })?.status).toBe("ENDED");
    expect(captureStatusFrom({ status: "completed", completion_reason: "awaiting_admission_timeout" })).toEqual({
      status: "FAILED",
      error: "Le robot n’a pas été admis dans la réunion à temps.",
    });
    expect(captureStatusFrom({ status: "failed", failure_stage: "active" })?.error).toContain("en pleine réunion");
  });

  it("ignore un état inconnu", () => {
    expect(captureStatusFrom({ status: "teleporting" })).toBeNull();
    expect(isLive("RECORDING")).toBe(true);
    expect(isLive("APPROVED")).toBe(false);
  });
});

describe("clés des travaux", () => {
  it("une lecture d'agenda par tranche de 5 minutes", () => {
    expect(calendarSyncKey(new Date("2026-10-12T09:03:59Z"))).toBe("calsync:2026-10-12T09:00");
    expect(calendarSyncKey(new Date("2026-10-12T09:05:00Z"))).toBe("calsync:2026-10-12T09:05");
    expect(watchKey(new Date("2026-10-12T09:04:00Z"))).toBe("meetwatch:2026-10-12T09:00");
  });

  it("un envoi par heure de début, un suivi par minute", () => {
    const start = new Date("2026-10-12T09:00:00Z");
    expect(dispatchKey("m1", start)).toBe("bot:m1:2026-10-12T09:00:00.000Z");
    expect(dispatchKey("m1", new Date("2026-10-12T10:00:00Z"))).not.toBe(dispatchKey("m1", start));
    expect(pollKey("m1", new Date("2026-10-12T09:01:30Z"))).toBe("meetpoll:m1:2026-10-12T09:01");
  });
});
