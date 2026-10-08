import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { parseQuickAdd } from "@/lib/quick-add";

const TEAM = [
  { id: "u-odo", name: "Odo Klein" },
  { id: "u-biba", name: "Biba Martin" },
];

const day = (date?: Date) => (date ? format(date, "yyyy-MM-dd") : undefined);
// Dates locales : le parseur travaille en heure locale (voir P1-06).
const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h, 0);

describe("parseQuickAdd", () => {
  it("lit tous les jetons d’une saisie complète", () => {
    const result = parseQuickAdd(
      "Retirer l'ombre @odo !haute #homepage demain $",
      TEAM,
      at(2026, 10, 8),
    );
    expect(result.title).toBe("Retirer l'ombre");
    expect(result.assigneeId).toBe("u-odo");
    expect(result.priority).toBe("HIGH");
    expect(result.zone).toBe("Homepage");
    expect(day(result.dueDate)).toBe("2026-10-09");
    expect(result.billable).toBe(true);
    expect(result.tokens.map((t) => t.kind)).toEqual([
      "assignee",
      "priority",
      "zone",
      "due",
      "billable",
    ]);
  });

  it("« !!! » donne la priorité urgente", () => {
    expect(parseQuickAdd("Corriger !!!", TEAM).priority).toBe("URGENT");
  });

  it("« !! » donne la priorité haute", () => {
    expect(parseQuickAdd("Corriger !!", TEAM).priority).toBe("HIGH");
  });

  it("« +3j » ajoute trois jours", () => {
    const result = parseQuickAdd("Relire +3j", TEAM, at(2026, 10, 8));
    expect(result.title).toBe("Relire");
    expect(day(result.dueDate)).toBe("2026-10-11");
  });

  it("« 12/01 » saisi le 20/12 vise l’année suivante", () => {
    const result = parseQuickAdd("Livrer 12/01", TEAM, at(2026, 12, 20));
    expect(day(result.dueDate)).toBe("2027-01-12");
  });

  it("« 12/10 » saisi le 08/10 reste dans l’année", () => {
    const result = parseQuickAdd("Livrer 12/10", TEAM, at(2026, 10, 8));
    expect(day(result.dueDate)).toBe("2026-10-12");
  });

  it("une date impossible (31/02) reste dans le titre", () => {
    const result = parseQuickAdd("Livrer 31/02", TEAM, at(2026, 10, 8));
    expect(result.dueDate).toBeUndefined();
    expect(result.title).toBe("Livrer 31/02");
  });

  it("un membre inconnu reste dans le titre", () => {
    const result = parseQuickAdd("Appeler @inconnu", TEAM);
    expect(result.assigneeId).toBeUndefined();
    expect(result.title).toBe("Appeler @inconnu");
  });

  it("un jour de semaine vise le prochain", () => {
    // 2026-10-08 est un jeudi
    expect(day(parseQuickAdd("Point lundi", TEAM, at(2026, 10, 8)).dueDate)).toBe("2026-10-12");
  });

  // P1-03 : l'ordre de l'équipe ne doit pas décider de la personne attribuée.
  it.fails("« @an » prend le premier prénom par ordre alphabétique (P1-03)", () => {
    const team = [
      { id: "u-antoine", name: "Antoine Dupont" },
      { id: "u-anais", name: "Anaïs Roux" },
      { id: "u-amine", name: "Amine Ben" },
    ];
    expect(parseQuickAdd("Tâche @an", team).assigneeId).toBe("u-anais");
  });
});
