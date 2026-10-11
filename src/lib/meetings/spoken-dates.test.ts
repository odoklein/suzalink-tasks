import { describe, expect, it } from "vitest";

import { resolveSpokenDue } from "@/lib/meetings/spoken-dates";
import { formatParis } from "@/lib/time";

// Lundi 12 octobre 2026, 11 h à Paris.
const meeting = new Date("2026-10-12T09:00:00Z");
const day = (spoken: string, at = meeting) => {
  const date = resolveSpokenDue(spoken, at);
  return date ? formatParis(date, "yyyy-MM-dd HH:mm") : null;
};

describe("resolveSpokenDue", () => {
  it("résout les dates relatives au jour de la réunion, à minuit à Paris", () => {
    expect(day("demain")).toBe("2026-10-13 00:00");
    expect(day("Après-demain")).toBe("2026-10-14 00:00");
    expect(day("aujourd’hui")).toBe("2026-10-12 00:00");
    expect(day("d’ici jeudi")).toBe("2026-10-15 00:00");
    expect(day("avant lundi")).toBe("2026-10-19 00:00");
  });

  it("résout les dates dites en clair", () => {
    expect(day("le 20 octobre")).toBe("2026-10-20 00:00");
    expect(day("1er novembre")).toBe("2026-11-01 00:00");
    expect(day("le 5 janvier")).toBe("2027-01-05 00:00");
    expect(day("le 30/10")).toBe("2026-10-30 00:00");
    expect(day("le 31 février")).toBeNull();
  });

  it("passe le changement d'heure sans décaler le jour", () => {
    // Réunion le vendredi 23 octobre 2026 ; l'heure d'hiver arrive le dimanche 25.
    expect(day("lundi", new Date("2026-10-23T08:00:00Z"))).toBe("2026-10-26 00:00");
  });

  it("laisse vide ce qui est ambigu", () => {
    for (const spoken of ["la semaine prochaine", "mardi prochain", "fin du mois", "bientôt", "dès que possible", "lundi ou mardi", ""]) {
      expect(resolveSpokenDue(spoken, meeting)).toBeNull();
    }
    expect(resolveSpokenDue(null, meeting)).toBeNull();
  });
});
