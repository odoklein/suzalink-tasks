import { describe, expect, it } from "vitest";

import { formatKeys } from "@/lib/keys";

describe("formatKeys", () => {
  it("adapte Mod au système", () => {
    expect(formatKeys("Mod+K", true)).toBe("⌘K");
    expect(formatKeys("Mod+K", false)).toBe("Ctrl K");
  });

  it("traduit les touches nommées", () => {
    expect(formatKeys("Mod+Enter", false)).toBe("Ctrl Entrée");
    expect(formatKeys("Shift+I", false)).toBe("Maj I");
    expect(formatKeys("Shift+I", true)).toBe("⇧I");
  });

  it("met les lettres seules en majuscules", () => {
    expect(formatKeys("c", false)).toBe("C");
  });
});
