import { describe, expect, it } from "vitest";

import { matchScore, rankSearchResults } from "@/lib/search";

describe("matchScore", () => {
  it("ignore accents et casse", () => {
    expect(matchScore("medailles", "Médailles du concours")).toBe(3);
    expect(matchScore("MÉDAILLES", "Ajouter les médailles")).toBe(2);
    expect(matchScore("dail", "Ajouter les médailles")).toBe(1);
    expect(matchScore("vidéo", "Bannière")).toBe(0);
  });
});

describe("rankSearchResults", () => {
  it("met d’abord les titres qui commencent par la requête", () => {
    const items = [
      { title: "Corriger la page des médailles", zone: null },
      { title: "Médailles : nouveau visuel", zone: null },
      { title: "Bannière", zone: "Médailles" },
    ];
    expect(rankSearchResults("médailles", items, (item) => [item.title, item.zone]).map((item) => item.title)).toEqual([
      "Médailles : nouveau visuel",
      "Corriger la page des médailles",
      "Bannière",
    ]);
  });
});
