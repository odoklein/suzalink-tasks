import { describe, expect, it } from "vitest";

import { capitalizeFirst, formatPercent, joinOr, nbspPunctuation, NNBSP, quote } from "./fr";
import { plural } from "./plural";

describe("plural", () => {
  it("accorde selon la règle française", () => {
    expect(plural(0, "tâche")).toBe("0 tâche");
    expect(plural(1, "tâche")).toBe("1 tâche");
    expect(plural(3, "tâche")).toBe("3 tâches");
    expect(plural(18, "retour importé", "retours importés")).toBe("18 retours importés");
    expect(plural(1, "retour importé", "retours importés")).toBe("1 retour importé");
  });
});

describe("fr", () => {
  it("met une espace fine insécable avant : ; ! ? et dans les guillemets", () => {
    expect(nbspPunctuation("Astuce : oui ; non ! Vraiment ?")).toBe(`Astuce${NNBSP}: oui${NNBSP}; non${NNBSP}! Vraiment${NNBSP}?`);
    expect(nbspPunctuation("https://tasks.suzaliconseil.com")).toBe("https://tasks.suzaliconseil.com");
    expect(quote("Fait")).toBe(`«${NNBSP}Fait${NNBSP}»`);
  });

  it("formate les pourcentages avec Intl (fr-FR)", () => {
    expect(formatPercent(0.42)).toBe(`42${NNBSP}%`);
    expect(formatPercent(Number.NaN)).toBe(`0${NNBSP}%`);
  });

  it("ne met en majuscule que la première lettre", () => {
    expect(capitalizeFirst("jeudi 8 octobre")).toBe("Jeudi 8 octobre");
    expect(capitalizeFirst("éte")).toBe("Éte");
  });

  it("énumère avec « ou »", () => {
    expect(joinOr(["Odo"])).toBe("Odo");
    expect(joinOr(["Odo", "Hichem"])).toBe("Odo ou Hichem");
    expect(joinOr(["Amine", "Hichem", "Odo"])).toBe("Amine, Hichem ou Odo");
  });
});
