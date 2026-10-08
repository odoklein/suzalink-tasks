import { describe, expect, it } from "vitest";

import {
  attemptLogin,
  formatLockDuration,
  invalidMessage,
  lockedMessage,
  MAX_ATTEMPTS,
  memoryAttemptStore,
} from "./login-attempts";

const fresh = () => ({ u1: { failedLogins: 0, lockedUntil: null as Date | null, lockLevel: 0 } });

/** Vérification asynchrone (comme bcrypt) qui compte ses appels et laisse les autres essais s'intercaler. */
function counter(result: boolean) {
  const calls = { n: 0 };
  const verify = async () => {
    calls.n += 1;
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
    return result;
  };
  return { calls, verify };
}

describe("attemptLogin (P1-11)", () => {
  it("10 essais faux en parallèle : au plus 5 vérifiés, et un seul blocage posé", async () => {
    const rows = fresh();
    const store = memoryAttemptStore(rows);
    const { calls, verify } = counter(false);

    const outcomes = await Promise.all(Array.from({ length: 10 }, () => attemptLogin(store, "u1", verify)));

    expect(calls.n).toBeLessThanOrEqual(MAX_ATTEMPTS);
    expect(outcomes.filter((o) => o.kind === "locked").length).toBeGreaterThanOrEqual(5);
    expect(rows.u1.lockedUntil).not.toBeNull();
    expect(rows.u1.lockLevel).toBe(1); // blocage escaladé une seule fois
  });

  it("un compte bloqué refuse même le bon code, sans le vérifier", async () => {
    const rows = fresh();
    rows.u1.lockedUntil = new Date(Date.now() + 60_000);
    const { calls, verify } = counter(true);
    const outcome = await attemptLogin(memoryAttemptStore(rows), "u1", verify);
    expect(outcome.kind).toBe("locked");
    expect(calls.n).toBe(0);
  });

  it("avertit à partir du 3ᵉ échec, puis bloque au 5ᵉ", async () => {
    const store = memoryAttemptStore(fresh());
    const { verify } = counter(false);
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await attemptLogin(store, "u1", verify));
    expect(results.slice(0, 4)).toEqual([
      { kind: "invalid", remaining: null },
      { kind: "invalid", remaining: null },
      { kind: "invalid", remaining: 2 },
      { kind: "invalid", remaining: 1 },
    ]);
    expect(results[4].kind).toBe("locked");
  });

  it("escalade : 15 min, puis 1 h, puis 24 h ; une connexion réussie remet tout à zéro", async () => {
    let now = new Date("2026-10-08T10:00:00Z");
    const rows = fresh();
    const store = memoryAttemptStore(rows, () => now);
    const wrong = counter(false).verify;
    const lockDurations: number[] = [];

    for (let cycle = 0; cycle < 3; cycle++) {
      let outcome;
      for (let i = 0; i < MAX_ATTEMPTS; i++) outcome = await attemptLogin(store, "u1", wrong);
      if (outcome?.kind !== "locked") throw new Error("blocage attendu");
      lockDurations.push((outcome.until.getTime() - now.getTime()) / 60_000);
      now = new Date(outcome.until.getTime() + 1000); // fin du blocage
    }
    expect(lockDurations).toEqual([15, 60, 1440]);

    expect(await attemptLogin(store, "u1", counter(true).verify)).toEqual({ kind: "ok" });
    expect(rows.u1).toEqual({ failedLogins: 0, lockedUntil: null, lockLevel: 0 });
  });
});

describe("messages", () => {
  it("formate la durée restante", () => {
    expect(formatLockDuration(15 * 60_000)).toBe("15 minutes");
    expect(formatLockDuration(30_000)).toBe("1 minute");
    expect(formatLockDuration(60 * 60_000)).toBe("1 heure");
    expect(formatLockDuration(24 * 60 * 60_000)).toBe("24 heures");
  });

  it("annonce les essais restants", () => {
    expect(invalidMessage(null)).toBe("Email ou code incorrect.");
    expect(invalidMessage(2)).toBe("Code incorrect. Encore 2 essais avant blocage.");
    expect(invalidMessage(1)).toBe("Code incorrect. Encore 1 essai avant blocage.");
    const now = new Date("2026-10-08T10:00:00Z");
    expect(lockedMessage(new Date(now.getTime() + 15 * 60_000), now)).toBe("Trop d’erreurs. Réessayez dans 15 minutes.");
  });
});
