import { describe, expect, it } from "vitest";

import { firstName, isValidEmail, parseLegacyContacts, primaryContact } from "@/lib/contacts";

describe("parseLegacyContacts", () => {
  it("sépare les noms et lit les rôles entre parenthèses", () => {
    expect(parseLegacyContacts("Luna Cervi (cheffe de projet), Clémentine Burdet-Micolle")).toEqual([
      { name: "Luna Cervi", role: "cheffe de projet" },
      { name: "Clémentine Burdet-Micolle", role: null },
    ]);
  });

  it("ne coupe pas à l’intérieur des parenthèses", () => {
    expect(parseLegacyContacts("Luna (cheffe de projet, design), Amine")).toEqual([
      { name: "Luna", role: "cheffe de projet, design" },
      { name: "Amine", role: null },
    ]);
  });

  it("accepte aussi les points-virgules et les retours à la ligne", () => {
    expect(parseLegacyContacts("A; B\nC")).toEqual([
      { name: "A", role: null },
      { name: "B", role: null },
      { name: "C", role: null },
    ]);
  });

  it("renvoie une liste vide pour un champ vide", () => {
    expect(parseLegacyContacts(null)).toEqual([]);
    expect(parseLegacyContacts("  , ; ")).toEqual([]);
  });
});

describe("firstName / primaryContact / isValidEmail", () => {
  it("extrait le prénom", () => {
    expect(firstName("Luna Cervi")).toBe("Luna");
    expect(firstName("  ")).toBe("");
    expect(firstName(null)).toBe("");
  });

  it("prend le contact principal, sinon le plus ancien", () => {
    const a = { isPrimary: false, createdAt: "2026-10-02T00:00:00Z", name: "a" };
    const b = { isPrimary: false, createdAt: "2026-10-01T00:00:00Z", name: "b" };
    const c = { isPrimary: true, createdAt: "2026-10-03T00:00:00Z", name: "c" };
    expect(primaryContact([a, b, c])?.name).toBe("c");
    expect(primaryContact([a, b])?.name).toBe("b");
    expect(primaryContact([])).toBeNull();
  });

  it("valide les adresses", () => {
    expect(isValidEmail("luna@exemple.fr")).toBe(true);
    expect(isValidEmail("luna@exemple")).toBe(false);
  });
});
