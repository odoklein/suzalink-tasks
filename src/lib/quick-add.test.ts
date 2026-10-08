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

  // P1-03 : l'ordre de l'équipe ne doit jamais décider de la personne attribuée.
  describe("@prénom ambigu (P1-03)", () => {
    const antoine = { id: "u-antoine", name: "Antoine Dupont" };
    const anais = { id: "u-anais", name: "Anaïs Roux" };
    const amine = { id: "u-amine", name: "Amine Ben" };
    const permutations = [
      [antoine, anais, amine],
      [amine, anais, antoine],
      [anais, antoine, amine],
      [antoine, amine, anais],
    ];

    it("« @an » désigne Anaïs et Antoine : personne n'est attribué, le mot reste dans le titre", () => {
      for (const team of permutations) {
        const result = parseQuickAdd("Tâche @an", team);
        expect(result.assigneeId).toBeUndefined();
        expect(result.title).toBe("Tâche @an");
        expect(result.tokens).toHaveLength(1);
        expect(result.tokens[0].kind).toBe("ambiguous");
        // candidats triés par ordre alphabétique, quel que soit l'ordre de l'équipe
        expect(result.tokens[0].candidates?.map((c) => c.id)).toEqual(["u-anais", "u-antoine"]);
        expect(result.tokens[0].label).toBe("@an : Anaïs ou Antoine ?");
      }
    });

    it("un préfixe unique suffit (« @ami » → Amine), quel que soit l'ordre", () => {
      for (const team of permutations) {
        expect(parseQuickAdd("Tâche @ami", team).assigneeId).toBe("u-amine");
      }
    });

    it("un prénom exact l'emporte sur un préfixe (« @ana » → Ana, pas Anaïs)", () => {
      const ana = { id: "u-ana", name: "Ana Petit" };
      expect(parseQuickAdd("Tâche @ana", [anais, ana, antoine]).assigneeId).toBe("u-ana");
      expect(parseQuickAdd("Tâche @ana", [ana, anais, antoine]).assigneeId).toBe("u-ana");
    });

    it("la casse et les accents sont ignorés (« @ANAIS »)", () => {
      expect(parseQuickAdd("Tâche @ANAIS", permutations[0]).assigneeId).toBe("u-anais");
    });
  });
});
