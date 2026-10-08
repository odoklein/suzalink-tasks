import { describe, expect, it } from "vitest";
import { computePosition } from "@/lib/position";

describe("computePosition", () => {
  it("colonne vide", () => {
    expect(computePosition()).toBe(1000);
  });

  it("en tête de colonne", () => {
    expect(computePosition(undefined, 1000)).toBe(0);
  });

  it("en bas de colonne", () => {
    expect(computePosition(3000, undefined)).toBe(4000);
  });

  it("entre deux voisins", () => {
    expect(computePosition(1000, 2000)).toBe(1500);
  });

  // Toujours juste après le premier élément : l'écart est divisé par 2 à chaque insertion.
  const insertAfterFirst = (count: number) => {
    const first = 1000;
    let next = 2000;
    for (let i = 0; i < count; i++) {
      const position = computePosition(first, next);
      expect(position).toBeGreaterThan(first);
      expect(position).toBeLessThan(next);
      next = position;
    }
  };

  it("30 insertions successives au même endroit restent strictement croissantes", () => {
    insertAfterFirst(30);
  });

  // Connu : au-delà d'une quarantaine d'insertions au même endroit, la précision des
  // flottants est épuisée et deux tâches reçoivent la même position. Aucune tâche du plan
  // ne le corrige encore (il faudrait un rééquilibrage des positions d'une colonne).
  it.fails("60 insertions successives au même endroit restent strictement croissantes", () => {
    insertAfterFirst(60);
  });
});
