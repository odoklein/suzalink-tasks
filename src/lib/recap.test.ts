import { describe, expect, it } from "vitest";

import { recapCounts, renderRecapText, type RecapFacts } from "@/lib/recap";

const facts: RecapFacts = {
  project: { id: "p1", name: "Bières Georges", key: "BG", siteUrl: "https://bieres.netlify.app" },
  since: null,
  lastDelivery: { title: "Corrections", deployedAt: new Date("2026-10-07T13:05:00Z"), url: null },
  done: [
    { ref: "BG-1", title: "Retirer l'ombre", zone: "Homepage", status: "DONE", statusChangedAt: new Date() },
    { ref: "BG-2", title: "Changer le logo", zone: null, status: "DONE", statusChangedAt: new Date() },
  ],
  waiting: [{ ref: "BG-3", title: "Visuels HD", zone: "Homepage", status: "WAITING_CLIENT", statusChangedAt: new Date() }],
  remaining: [{ ref: "BG-4", title: "Formulaire", zone: "Contact", status: "IN_PROGRESS", statusChangedAt: new Date() }],
};

describe("renderRecapText", () => {
  const text = renderRecapText(facts);
  it("donne l'heure de la mise en ligne à Paris", () => {
    expect(text).toContain("Dernière mise en ligne le 7 octobre à 15h05 : https://bieres.netlify.app.");
  });
  it("regroupe par page", () => {
    expect(text).toContain("CE QUI EST FAIT\n\nHomepage\n  - Retirer l'ombre\n\nGénéral\n  - Changer le logo");
    expect(text).toContain("EN ATTENTE DE VOTRE CÔTÉ\n\nHomepage\n  - Visuels HD");
    expect(text).toContain("  - Formulaire (en cours)");
  });
  it("compte les sections", () => {
    expect(recapCounts(facts)).toEqual({ done: 2, waiting: 1, remaining: 1 });
  });
});
