import { describe, expect, it } from "vitest";

import { creationTargets } from "./last-project";

const projects = [
  { slug: "archives-x", status: "DONE" },
  { slug: "bieres-georges", status: "ACTIVE" },
  { slug: "cresus", status: "PAUSED" },
  { slug: "luna", status: "WAITING_CLIENT" },
];

describe("creationTargets (P1-15)", () => {
  it("met le projet affiché, puis le dernier utilisé, puis les projets actifs", () => {
    expect(creationTargets(projects, "cresus", "archives-x").map((p) => p.slug)).toEqual([
      "cresus",
      "archives-x",
      "bieres-georges",
      "luna",
    ]);
  });

  it("sans projet courant ni dernier projet : seulement les actifs, sans doublon", () => {
    expect(creationTargets(projects, null, "luna").map((p) => p.slug)).toEqual(["luna", "bieres-georges"]);
    expect(creationTargets(projects, "inconnu", null).map((p) => p.slug)).toEqual(["bieres-georges", "luna"]);
  });
});
