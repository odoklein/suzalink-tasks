import { afterEach, describe, expect, it, vi } from "vitest";
import {
  endOfDayParis,
  formatParis,
  fromParisDateTimeInput,
  nowParis,
  startOfDayParis,
  toParisDateInput,
  toParisDateTimeInput,
} from "@/lib/time";

afterEach(() => vi.useRealTimers());

describe("startOfDayParis / endOfDayParis", () => {
  it("23 h 30 UTC est déjà le lendemain à Paris (été)", () => {
    const d = new Date("2026-10-08T23:30:00Z");
    expect(startOfDayParis(d).toISOString()).toBe("2026-10-08T22:00:00.000Z"); // 2026-10-09T00:00+02:00
    expect(endOfDayParis(d).toISOString()).toBe("2026-10-09T21:59:59.999Z"); // 2026-10-09T23:59:59.999+02:00
  });

  it("22 h 30 UTC est encore le jour même à Paris", () => {
    const d = new Date("2026-10-08T21:30:00Z");
    expect(startOfDayParis(d).toISOString()).toBe("2026-10-07T22:00:00.000Z");
  });

  it("renvoie un Date ordinaire", () => {
    expect(Object.getPrototypeOf(startOfDayParis(new Date()))).toBe(Date.prototype);
  });

  it("le 25/10/2026 (fin de l’heure d’été) dure 25 heures", () => {
    const d = new Date("2026-10-25T12:00:00Z");
    const start = startOfDayParis(d); // 00:00+02:00
    const end = endOfDayParis(d); // 23:59:59.999+01:00
    expect(start.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-25T22:59:59.999Z");
    expect((end.getTime() + 1 - start.getTime()) / 3_600_000).toBe(25);
  });

  it("le 29/03/2026 (début de l’heure d’été) dure 23 heures", () => {
    const d = new Date("2026-03-29T12:00:00Z");
    const hours =
      (endOfDayParis(d).getTime() + 1 - startOfDayParis(d).getTime()) / 3_600_000;
    expect(hours).toBe(23);
  });
});

describe("toParisDateInput / toParisDateTimeInput", () => {
  it("affichent l’heure de Paris", () => {
    const d = new Date("2026-10-08T23:30:00Z");
    expect(toParisDateInput(d)).toBe("2026-10-09");
    expect(toParisDateTimeInput(d)).toBe("2026-10-09T01:30");
  });

  it("utilisent le décalage d’hiver en janvier", () => {
    expect(toParisDateTimeInput(new Date("2026-01-15T10:00:00Z"))).toBe("2026-01-15T11:00");
  });
});

describe("fromParisDateTimeInput", () => {
  it("lit une saisie à l’heure de Paris (été)", () => {
    expect(fromParisDateTimeInput("2026-10-08T14:00").toISOString()).toBe("2026-10-08T12:00:00.000Z");
  });

  it("lit une saisie à l’heure de Paris (hiver)", () => {
    expect(fromParisDateTimeInput("2026-12-08T14:00").toISOString()).toBe("2026-12-08T13:00:00.000Z");
  });

  it("le jour du changement d’heure, midi est en heure d’hiver", () => {
    expect(fromParisDateTimeInput("2026-10-25T12:00").toISOString()).toBe("2026-10-25T11:00:00.000Z");
  });

  it("fait l’aller-retour avec toParisDateTimeInput", () => {
    expect(toParisDateTimeInput(fromParisDateTimeInput("2026-07-14T09:15"))).toBe("2026-07-14T09:15");
  });

  it("renvoie une date invalide pour une saisie illisible", () => {
    expect(Number.isNaN(fromParisDateTimeInput("demain").getTime())).toBe(true);
  });
});

describe("formatParis / nowParis", () => {
  it("formate en français à l’heure de Paris", () => {
    expect(formatParis(new Date("2026-10-08T23:30:00Z"), "EEEE d MMMM HH'h'mm")).toBe(
      "vendredi 9 octobre 01h30",
    );
  });

  it("nowParis donne l’heure murale de Paris", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T23:30:00Z"));
    const now = nowParis();
    expect(now.getHours()).toBe(1);
    expect(now.getDate()).toBe(9);
  });
});
