import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { openWith, sealWith } from "@/lib/secret-box";

const key = randomBytes(32).toString("base64");

describe("sealWith / openWith", () => {
  it("chiffre puis déchiffre", () => {
    const sealed = sealWith(key, "1//refresh-token");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("refresh-token");
    expect(openWith(key, sealed)).toBe("1//refresh-token");
  });

  it("ne produit jamais deux fois le même texte chiffré", () => {
    expect(sealWith(key, "même valeur")).not.toBe(sealWith(key, "même valeur"));
  });

  it("refuse une valeur altérée ou une autre clé", () => {
    const sealed = sealWith(key, "secret");
    const parts = sealed.split(".");
    const tampered = [...parts.slice(0, 3), Buffer.from("autre").toString("base64url")].join(".");
    expect(() => openWith(key, tampered)).toThrow();
    expect(() => openWith(randomBytes(32).toString("base64"), sealed)).toThrow();
    expect(() => openWith(key, "v2.a.b.c")).toThrow("illisible");
  });

  it("refuse une clé de mauvaise longueur", () => {
    expect(() => sealWith(randomBytes(16).toString("base64"), "x")).toThrow("32 octets");
  });
});
