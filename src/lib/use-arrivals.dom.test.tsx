import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useArrivals } from "@/lib/use-arrivals";

type Item = { id: string; key: string };

const items = (...pairs: [string, string][]): Item[] => pairs.map(([id, key]) => ({ id, key }));

describe("useArrivals", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ne signale rien au premier rendu", () => {
    const { result } = renderHook(() => useArrivals(items(["a", "TODO"], ["b", "DONE"])));
    expect(result.current.size).toBe(0);
  });

  it("signale une nouvelle tâche, puis l’efface", () => {
    const { result, rerender } = renderHook(({ list }) => useArrivals(list), {
      initialProps: { list: items(["a", "TODO"]) },
    });
    rerender({ list: items(["a", "TODO"], ["b", "TODO"]) });
    expect([...result.current]).toEqual(["b"]);
    act(() => void vi.advanceTimersByTime(800));
    expect(result.current.size).toBe(0);
  });

  it("signale une tâche passée dans un autre groupe", () => {
    const { result, rerender } = renderHook(({ list }) => useArrivals(list), {
      initialProps: { list: items(["a", "TODO"], ["b", "TODO"]) },
    });
    rerender({ list: items(["a", "TODO"], ["b", "DONE"]) });
    expect([...result.current]).toEqual(["b"]);
  });

  it("met la mémoire à jour sans rien signaler quand il est désactivé", () => {
    const { result, rerender } = renderHook(({ list, enabled }) => useArrivals(list, enabled), {
      initialProps: { list: items(["a", "TODO"]), enabled: false },
    });
    rerender({ list: items(["a", "DONE"]), enabled: false });
    expect(result.current.size).toBe(0);
    // Une fois réactivé, la tâche déjà posée ne clignote pas une seconde fois.
    rerender({ list: items(["a", "DONE"]), enabled: true });
    expect(result.current.size).toBe(0);
  });

  it("ignore une resynchronisation en masse", () => {
    const many = Array.from({ length: 20 }, (_, index): [string, string] => [`t${index}`, "TODO"]);
    const { result, rerender } = renderHook(({ list }) => useArrivals(list), {
      initialProps: { list: items(["a", "TODO"]) },
    });
    rerender({ list: items(["a", "TODO"], ...many) });
    expect(result.current.size).toBe(0);
  });

  it("ne signale pas une suppression", () => {
    const { result, rerender } = renderHook(({ list }) => useArrivals(list), {
      initialProps: { list: items(["a", "TODO"], ["b", "TODO"]) },
    });
    rerender({ list: items(["a", "TODO"]) });
    expect(result.current.size).toBe(0);
  });
});
