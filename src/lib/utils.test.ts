import { afterEach, describe, expect, it, vi } from "vitest";
import { cn, dueTone, formatDateTime, formatDue, formatShortDate, initials, projectKey, slugify } from "@/lib/utils";

describe("slugify", () => {
  it("retire les accents et la ponctuation", () => {
    expect(slugify("Éé Ça!")).toBe("ee-ca");
  });

  it("limite la longueur à 48 caractères", () => {
    expect(slugify("a".repeat(80))).toHaveLength(48);
  });
});

describe("projectKey", () => {
  it("prend les initiales des mots", () => {
    expect(projectKey("BIERES GEORGES")).toBe("BG");
    expect(projectKey("Crésus Paie")).toBe("CP");
  });

  it("prend 3 lettres pour un mot seul", () => {
    expect(projectKey("Suzali")).toBe("SUZ");
  });

  it("garde 4 caractères au maximum", () => {
    expect(projectKey("a b c d e f")).toBe("ABCD");
  });

  it("retombe sur P sans lettre", () => {
    expect(projectKey("!!!")).toBe("P");
  });
});

describe("initials", () => {
  it("garde deux lettres en majuscules", () => {
    expect(initials("odo klein martin")).toBe("OK");
  });
});

describe("formatDateTime (heure de Paris)", () => {
  it("affiche 14h30 pour 12:30 UTC en octobre (UTC+2), quel que soit le fuseau de la machine", () => {
    expect(formatDateTime(new Date("2026-10-08T12:30:00Z"))).toBe("8 oct. 2026 à 14h30");
  });

  it("affiche 14h30 pour 13:30 UTC en décembre (UTC+1)", () => {
    expect(formatDateTime("2026-12-08T13:30:00Z")).toBe("8 déc. 2026 à 14h30");
  });

  it("change de jour à minuit de Paris, pas de minuit UTC", () => {
    expect(formatShortDate(new Date("2026-10-08T22:30:00Z"))).toBe("09/10");
  });
});

describe("formatDue / dueTone (jours calendaires à Paris)", () => {
  afterEach(() => vi.useRealTimers());

  it("à 00h30 Paris (22h30 UTC), une échéance du lendemain parisien est « Demain »", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T22:30:00Z")); // 09/10 00:30 à Paris
    const due = new Date("2026-10-09T22:00:00Z"); // minuit à Paris du 10/10
    expect(formatDue(due)).toBe("Demain");
    expect(formatDue(new Date("2026-10-08T22:00:00Z"))).toBe("Aujourd'hui");
    expect(formatDue(new Date("2026-10-07T22:00:00Z"))).toBe("Hier");
    expect(dueTone(new Date("2026-10-07T22:00:00Z"))).toBe("overdue");
    expect(dueTone(due)).toBe("soon");
  });

  it("au-delà, affiche le jour abrégé en français", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T10:00:00Z"));
    expect(formatDue(new Date("2026-10-11T22:00:00Z"))).toBe("lun. 12 oct.");
  });
});

describe("cn", () => {
  it("ignore les valeurs fausses", () => {
    expect(cn("a", false, null, "b")).toBe("a b");
  });
});
