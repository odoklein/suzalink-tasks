import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  LEGACY_PROJECT_COLORS,
  normalizeProjectColor,
  PROJECT_PALETTE,
  projectColorPair,
  TILE_INK_DARK,
  TILE_INK_LIGHT,
} from "@/lib/color";

describe("palette des projets", () => {
  it.each(PROJECT_PALETTE.map((entry) => [entry.name, entry] as const))(
    "%s : texte lisible (≥ 4,5:1) en clair et en sombre",
    (_name, entry) => {
      expect(contrastRatio(TILE_INK_LIGHT, entry.light)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(TILE_INK_DARK, entry.dark)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("fait correspondre chaque ancienne couleur à une couleur de la palette", () => {
    const lights = PROJECT_PALETTE.map((entry) => entry.light);
    for (const next of Object.values(LEGACY_PROJECT_COLORS)) expect(lights).toContain(next);
  });

  it("accepte les anciennes couleurs, quelle que soit la casse", () => {
    expect(normalizeProjectColor("#e5533d")).toBe("#ba362e");
    expect(projectColorPair("#E5533D")).toEqual({ light: "#ba362e", dark: "#ef675a" });
  });

  it("laisse une couleur inconnue inchangée", () => {
    expect(projectColorPair("#123456")).toEqual({ light: "#123456", dark: "#123456" });
  });
});

describe("contrastRatio", () => {
  it("vaut 21 entre noir et blanc", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });
});
