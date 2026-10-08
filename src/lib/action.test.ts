import { notFound, redirect } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GENERIC_ERROR, safe } from "./action";

vi.mock("server-only", () => ({}));

afterEach(() => vi.restoreAllMocks());

describe("safe", () => {
  it("renvoie la valeur de l’action quand tout va bien", async () => {
    expect(await safe(async () => ({ ok: true as const }))).toEqual({ ok: true });
  });

  it("transforme une exception inattendue en { error } et la journalise", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await safe(async () => {
        throw new Error("base indisponible");
      }),
    ).toEqual({ error: GENERIC_ERROR });
    expect(log).toHaveBeenCalledOnce();
  });

  it("relance redirect() pour que Next fasse la redirection", async () => {
    await expect(safe(async () => redirect("/login"))).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("relance notFound()", async () => {
    await expect(safe(async () => notFound())).rejects.toBeDefined();
  });
});
