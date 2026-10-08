import { describe, expect, it } from "vitest";
import { isWeakPin } from "@/lib/pin";

describe("isWeakPin", () => {
  it.each(["111111", "000000", "123456", "987654", "234567"])("%s est trop faible", (pin) => {
    expect(isWeakPin(pin)).toBe(true);
  });

  it.each(["275039", "121212", "135790"])("%s est accepté", (pin) => {
    expect(isWeakPin(pin)).toBe(false);
  });
});
