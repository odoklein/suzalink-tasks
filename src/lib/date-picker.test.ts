import { describe, expect, it } from "vitest";

import { addDaysISO, monthGrid, parseDateInput, parseISODate, quickPicks, weekdayMonday0 } from "@/lib/date-picker";

// 2026-10-08 est un jeudi.
const TODAY = "2026-10-08";

describe("parseISODate", () => {
  it("refuse les dates inexistantes", () => {
    expect(parseISODate("2026-02-31")).toBeNull();
    expect(parseISODate("2026-13-01")).toBeNull();
    expect(parseISODate("12/10/2026")).toBeNull();
    expect(parseISODate("2026-10-08")).toEqual({ y: 2026, m: 10, d: 8 });
  });
});

describe("addDaysISO", () => {
  it("traverse les fins de mois, d’année et le changement d’heure", () => {
    expect(addDaysISO("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("quickPicks", () => {
  it("propose aujourd’hui, demain, lundi prochain, +1 semaine, aucune", () => {
    expect(quickPicks(TODAY)).toEqual([
      { label: "Aujourd’hui", value: "2026-10-08" },
      { label: "Demain", value: "2026-10-09" },
      { label: "Lundi", value: "2026-10-12" },
      { label: "+1 sem", value: "2026-10-15" },
      { label: "Aucune", value: null },
    ]);
  });

  it("un lundi, « Lundi » est le lundi suivant", () => {
    expect(quickPicks("2026-10-12")[2].value).toBe("2026-10-19");
  });
});

describe("monthGrid", () => {
  it("commence un lundi et couvre tout le mois", () => {
    const weeks = monthGrid(2026, 10);
    expect(weekdayMonday0(weeks[0][0].value)).toBe(0);
    expect(weeks[0][0].value).toBe("2026-09-28");
    const days = weeks.flat().filter((day) => day.inMonth);
    expect(days).toHaveLength(31);
    expect(days[0].value).toBe("2026-10-01");
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it("n’ajoute pas de semaine entièrement hors du mois", () => {
    expect(monthGrid(2027, 2)).toHaveLength(4); // février 2027 : du lundi 1er au dimanche 28
  });
});

describe("parseDateInput", () => {
  it("accepte la syntaxe de la saisie rapide", () => {
    expect(parseDateInput("demain", TODAY)).toBe("2026-10-09");
    expect(parseDateInput("lundi", TODAY)).toBe("2026-10-12");
    expect(parseDateInput("+3j", TODAY)).toBe("2026-10-11");
    expect(parseDateInput("12/10", TODAY)).toBe("2026-10-12");
    expect(parseDateInput("03/11/2026", TODAY)).toBe("2026-11-03");
  });

  it("accepte une date ISO, le vide (aucune date) et refuse le reste", () => {
    expect(parseDateInput("2026-12-01", TODAY)).toBe("2026-12-01");
    expect(parseDateInput("  ", TODAY)).toBeNull();
    expect(parseDateInput("bientôt", TODAY)).toBeUndefined();
    expect(parseDateInput("31/02", TODAY)).toBeUndefined();
  });
});
