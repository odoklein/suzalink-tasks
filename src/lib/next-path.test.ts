import { describe, expect, it } from "vitest";

import { safeNextPath } from "./next-path";

describe("safeNextPath (P1-13)", () => {
  it("garde un chemin interne avec sa recherche", () => {
    expect(safeNextPath("/projects/x?vue=liste")).toBe("/projects/x?vue=liste");
    expect(safeNextPath("/")).toBe("/");
  });

  it.each([
    ["//evil.example/x"],
    ["/\\evil.example"],
    ["https://evil.example"],
    ["projects/x"],
    [""],
    ["/a\nb"],
    ["/login?next=/x"],
    [undefined],
    [42],
  ])("refuse %j et renvoie l’accueil", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });
});
