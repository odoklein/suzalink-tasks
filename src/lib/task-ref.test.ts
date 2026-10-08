import { describe, expect, it } from "vitest";

import { formatTaskRef, isTaskRef, parseTaskRef, taskPath } from "@/lib/task-ref";

describe("parseTaskRef", () => {
  it("lit une référence, casse indifférente", () => {
    expect(parseTaskRef("BG-12")).toEqual({ key: "BG", number: 12 });
    expect(parseTaskRef(" bg-7 ")).toEqual({ key: "BG", number: 7 });
    expect(parseTaskRef("CP2-104")).toEqual({ key: "CP2", number: 104 });
  });

  it("refuse ce qui n’est pas une référence", () => {
    expect(parseTaskRef("clx1abc")).toBeNull();
    expect(parseTaskRef("12-BG")).toBeNull();
    expect(parseTaskRef("BG-")).toBeNull();
    expect(isTaskRef("médailles")).toBe(false);
  });

  it("formate et construit le lien court", () => {
    expect(formatTaskRef("BG", 12)).toBe("BG-12");
    expect(taskPath("BG-12")).toBe("/t/BG-12");
  });
});
