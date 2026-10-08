import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "@/lib/quick-add";
import { fromParisDateTimeInput, toParisDateInput } from "@/lib/time";

const TEAM = [
  { id: "u-odo", name: "Odo Klein" },
  { id: "u-biba", name: "Biba Martin" },
];

// Les dates sont des instants ; « le jour » se lit à Paris, quel que soit le fuseau de la machine.
const day = (date?: Date) => (date ? toParisDateInput(date) : undefined);
const at = (y: number, m: number, d: number, h = 10, min = 0) =>
  fromParisDateTimeInput(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);

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

  // P1-06 : le serveur tourne en UTC, l'équipe vit à Paris.
  describe("jour calendaire à Paris (P1-06)", () => {
    // 2026-10-09 00:30 à Paris = 2026-10-08 22:30 UTC
    const justAfterMidnight = new Date("2026-10-08T22:30:00Z");

    it("« demain » à 00h30 Paris est le 10/10, pas le 09/10", () => {
      const result = parseQuickAdd("Relire demain", TEAM, justAfterMidnight);
      expect(day(result.dueDate)).toBe("2026-10-10");
      expect(result.dueDate?.toISOString()).toBe("2026-10-09T22:00:00.000Z"); // minuit à Paris
    });

    it("« aujourd'hui » à 00h30 Paris est le 09/10", () => {
      expect(day(parseQuickAdd("Relire aujourd'hui", TEAM, justAfterMidnight).dueDate)).toBe("2026-10-09");
    });

    it("« +3j » et « 12/10 » donnent aussi des minuits parisiens", () => {
      expect(parseQuickAdd("A +3j", TEAM, justAfterMidnight).dueDate?.toISOString()).toBe("2026-10-11T22:00:00.000Z");
      expect(parseQuickAdd("A 12/10", TEAM, justAfterMidnight).dueDate?.toISOString()).toBe("2026-10-11T22:00:00.000Z");
    });

    it("un jour de semaine garde son minuit parisien au passage à l'heure d'hiver", () => {
      // vendredi 23/10/2026 → « lundi » = 26/10, après le passage à l'heure d'hiver (UTC+1)
      const result = parseQuickAdd("Point lundi", TEAM, at(2026, 10, 23));
      expect(result.dueDate?.toISOString()).toBe("2026-10-25T23:00:00.000Z");
      expect(day(result.dueDate)).toBe("2026-10-26");
    });

    it("« 12/01 » saisi le 20/12 à 00h30 Paris vise 2027", () => {
      expect(day(parseQuickAdd("Livrer 12/01", TEAM, at(2026, 12, 20, 0, 30)).dueDate)).toBe("2027-01-12");
    });

    it("un mois impossible (5/13) reste dans le titre", () => {
      const result = parseQuickAdd("Livrer 5/13", TEAM, at(2026, 10, 8));
      expect(result.dueDate).toBeUndefined();
      expect(result.title).toBe("Livrer 5/13");
    });
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
