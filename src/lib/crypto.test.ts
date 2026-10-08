import { describe, expect, it } from "vitest";

import { bearerMatches, hmacHex, safeEqual, sha256Hex } from "@/lib/crypto";

describe("safeEqual / bearerMatches", () => {
  it("compare à temps constant", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
  it("vérifie un Bearer", () => {
    expect(bearerMatches("Bearer s3cret", "s3cret")).toBe(true);
    expect(bearerMatches("bearer s3cret", "s3cret")).toBe(true);
    expect(bearerMatches("Bearer nope", "s3cret")).toBe(false);
    expect(bearerMatches(null, "s3cret")).toBe(false);
    // Sans secret configuré, rien ne passe.
    expect(bearerMatches("Bearer ", undefined)).toBe(false);
  });
});

describe("empreintes", () => {
  it("sha256 et HMAC (vecteurs connus)", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    // RFC 4231, cas 2.
    expect(hmacHex("sha256", "Jefe", "what do ya want for nothing?")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
  });
});
