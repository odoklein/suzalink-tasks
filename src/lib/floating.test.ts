import { describe, expect, it } from "vitest";

import { computeFloatingPosition } from "@/lib/floating";

const viewport = { width: 1000, height: 700 };
const size = { width: 200, height: 100 };

describe("computeFloatingPosition", () => {
  it("place sous l’ancre, alignée à gauche", () => {
    const anchor = { top: 100, left: 300, width: 80, height: 30 };
    expect(computeFloatingPosition(anchor, size, viewport)).toEqual({ top: 134, left: 300, placement: "bottom" });
  });

  it("se retourne au-dessus quand il n’y a pas la place en dessous", () => {
    const anchor = { top: 640, left: 300, width: 80, height: 30 };
    const result = computeFloatingPosition(anchor, size, viewport);
    expect(result.placement).toBe("top");
    expect(result.top).toBe(640 - 100 - 4);
  });

  it("reste en dessous s’il n’y a la place ni dessus ni dessous mais plus en dessous", () => {
    const small = { width: 1000, height: 150 };
    const anchor = { top: 40, left: 0, width: 80, height: 30 };
    expect(computeFloatingPosition(anchor, size, small).placement).toBe("bottom");
  });

  it("garde l’élément dans le viewport horizontalement", () => {
    const right = { top: 100, left: 950, width: 40, height: 30 };
    expect(computeFloatingPosition(right, size, viewport).left).toBe(1000 - 200 - 8);
    const left = { top: 100, left: -30, width: 40, height: 30 };
    expect(computeFloatingPosition(left, size, viewport).left).toBe(8);
  });

  it("aligne au centre et à droite", () => {
    const anchor = { top: 100, left: 400, width: 100, height: 30 };
    expect(computeFloatingPosition(anchor, size, viewport, { align: "center" }).left).toBe(350);
    expect(computeFloatingPosition(anchor, size, viewport, { align: "end" }).left).toBe(300);
  });
});
