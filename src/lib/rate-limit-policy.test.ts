import { describe, expect, it } from "vitest";

import { decide, windowStart } from "@/lib/rate-limit-policy";

describe("windowStart", () => {
  it("arrondit au début de la fenêtre", () => {
    expect(windowStart(new Date("2026-10-08T10:07:42Z"), 60).toISOString()).toBe("2026-10-08T10:07:00.000Z");
    expect(windowStart(new Date("2026-10-08T10:07:42Z"), 15 * 60).toISOString()).toBe("2026-10-08T10:00:00.000Z");
  });
});

describe("decide", () => {
  const now = new Date("2026-10-08T10:07:42Z");
  it("laisse passer jusqu'à la limite incluse", () => {
    expect(decide(5, 5, now, 60)).toEqual({ allowed: true, remaining: 0, retryAfterSec: 0, limit: 5 });
    expect(decide(1, 5, now, 60).remaining).toBe(4);
  });
  it("bloque au-delà, jusqu'à la fin de la fenêtre", () => {
    expect(decide(6, 5, now, 60)).toEqual({ allowed: false, remaining: 0, retryAfterSec: 18, limit: 5 });
    expect(decide(21, 20, now, 15 * 60).retryAfterSec).toBe(7 * 60 + 18);
  });
});
