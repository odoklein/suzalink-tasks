import { describe, expect, it } from "vitest";

import { parseRecentProjects, sidebarProjects } from "./recent-projects";

const project = (slug: string, tasks: number, status = "ACTIVE") => ({ slug, status, _count: { tasks } });

describe("sidebarProjects", () => {
  const projects = [project("a", 1), project("b", 9), project("c", 4), project("d", 7, "DONE"), project("e", 2)];

  it("sans historique, montre les projets en cours les plus chargés", () => {
    expect(sidebarProjects(projects, [], null, 3).map((p) => p.slug)).toEqual(["b", "c", "e"]);
  });

  it("place le projet ouvert puis les récents avant les autres, sans doublon", () => {
    expect(sidebarProjects(projects, ["a", "c"], "d", 4).map((p) => p.slug)).toEqual(["d", "a", "c", "b"]);
  });

  it("ignore les slugs inconnus (projet archivé ou supprimé)", () => {
    expect(sidebarProjects(projects, ["zzz", "e"], null, 2).map((p) => p.slug)).toEqual(["e", "b"]);
  });
});

describe("parseRecentProjects", () => {
  it("résiste à une valeur corrompue", () => {
    expect(parseRecentProjects("{oops")).toEqual([]);
    expect(parseRecentProjects('[1, "a", null]')).toEqual(["a"]);
  });
});
