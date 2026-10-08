import { describe, expect, it } from "vitest";

import { EnvError, integrationEnabled, parseEnv } from "@/lib/env";

const base = { DATABASE_URL: "postgresql://x", SESSION_SECRET: "x".repeat(32) };

describe("parseEnv", () => {
  it("accepte la configuration minimale et donne l'URL par défaut", () => {
    const env = parseEnv(base);
    expect(env.APP_URL).toBe("https://tasks.suzaliconseil.com");
    expect(integrationEnabled("cron", env)).toBe(false);
  });

  it("traite les chaînes vides comme absentes", () => {
    const env = parseEnv({ ...base, CRON_SECRET: "", SENTRY_DSN: "  " });
    expect(env.CRON_SECRET).toBeUndefined();
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("refuse un secret de session trop court", () => {
    expect(() => parseEnv({ ...base, SESSION_SECRET: "court" })).toThrow(EnvError);
  });

  it("refuse une URL invalide et liste tous les problèmes", () => {
    try {
      parseEnv({ DATABASE_URL: "", SESSION_SECRET: "x".repeat(32), APP_URL: "ftp://x", CRON_SECRET: "trop-court" });
      expect.unreachable();
    } catch (error) {
      expect((error as EnvError).problems).toHaveLength(3);
    }
  });

  it("active une intégration complète", () => {
    const env = parseEnv({ ...base, CRON_SECRET: "s".repeat(24), APP_URL: "https://exemple.fr/" });
    expect(integrationEnabled("cron", env)).toBe(true);
    expect(env.APP_URL).toBe("https://exemple.fr");
  });
});
