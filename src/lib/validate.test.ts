import { describe, expect, it } from "vitest";

import { isPlausibleDateInput, parseHttpUrl, parseProjectKey } from "./validate";

describe("parseHttpUrl (P1-18)", () => {
  it("accepte http et https, refuse le reste", () => {
    expect(parseHttpUrl("https://bieres.netlify.app")).toBe("https://bieres.netlify.app/");
    expect(parseHttpUrl("  http://exemple.fr/page?x=1 ")).toBe("http://exemple.fr/page?x=1");
    expect(parseHttpUrl("")).toBeNull();
    expect(parseHttpUrl(undefined)).toBeNull();
    expect(parseHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(parseHttpUrl("ftp://exemple.fr")).toBeUndefined();
    expect(parseHttpUrl("bieres.netlify.app")).toBeUndefined();
  });
});

describe("parseProjectKey (P1-18)", () => {
  it("met en majuscules 1 à 4 lettres ou chiffres", () => {
    expect(parseProjectKey("bg")).toBe("BG");
    expect(parseProjectKey("ab12")).toBe("AB12");
    expect(parseProjectKey("")).toBeNull();
    expect(parseProjectKey("ABCDE")).toBeUndefined();
    expect(parseProjectKey("B-G")).toBeUndefined();
    expect(parseProjectKey("É")).toBeUndefined();
  });
});

describe("isPlausibleDateInput (P1-18)", () => {
  it("ignore les années avant 2000", () => {
    expect(isPlausibleDateInput("2026-10-12")).toBe(true);
    expect(isPlausibleDateInput("0202-10-12")).toBe(false);
    expect(isPlausibleDateInput("1999-12-31")).toBe(false);
    expect(isPlausibleDateInput("")).toBe(false);
  });
});
