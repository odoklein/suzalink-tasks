import { describe, expect, it } from "vitest";
import { cn, initials, projectKey, slugify } from "@/lib/utils";

describe("slugify", () => {
  it("retire les accents et la ponctuation", () => {
    expect(slugify("Éé Ça!")).toBe("ee-ca");
  });

  it("limite la longueur à 48 caractères", () => {
    expect(slugify("a".repeat(80))).toHaveLength(48);
  });
});

describe("projectKey", () => {
  it("prend les initiales des mots", () => {
    expect(projectKey("BIERES GEORGES")).toBe("BG");
    expect(projectKey("Crésus Paie")).toBe("CP");
  });

  it("prend 3 lettres pour un mot seul", () => {
    expect(projectKey("Suzali")).toBe("SUZ");
  });

  it("garde 4 caractères au maximum", () => {
    expect(projectKey("a b c d e f")).toBe("ABCD");
  });

  it("retombe sur P sans lettre", () => {
    expect(projectKey("!!!")).toBe("P");
  });
});

describe("initials", () => {
  it("garde deux lettres en majuscules", () => {
    expect(initials("odo klein martin")).toBe("OK");
  });
});

describe("cn", () => {
  it("ignore les valeurs fausses", () => {
    expect(cn("a", false, null, "b")).toBe("a b");
  });
});
