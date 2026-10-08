import { describe, expect, it } from "vitest";

import { utcWallClockAsParis } from "./delivery-tz";

describe("utcWallClockAsParis (rattrapage P1-05)", () => {
  it("14:30 saisi en été et stocké 14:30Z redevient 12:30Z (14h30 à Paris)", () => {
    expect(utcWallClockAsParis(new Date("2026-10-08T14:30:00Z")).toISOString()).toBe("2026-10-08T12:30:00.000Z");
  });

  it("14:30 saisi en hiver et stocké 14:30Z redevient 13:30Z", () => {
    expect(utcWallClockAsParis(new Date("2026-12-08T14:30:00Z")).toISOString()).toBe("2026-12-08T13:30:00.000Z");
  });

  it("garde le bon jour quand la correction passe minuit", () => {
    expect(utcWallClockAsParis(new Date("2026-10-08T00:30:00Z")).toISOString()).toBe("2026-10-07T22:30:00.000Z");
  });
});
