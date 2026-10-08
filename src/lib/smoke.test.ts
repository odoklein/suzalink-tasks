import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("tooling", () => {
  it("résout l’alias @/", () => {
    expect(cn("a", false, "b")).toBe("a b");
  });
});
