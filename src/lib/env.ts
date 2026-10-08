import { z } from "zod";

/**
 * Variables d'environnement validées. Une valeur vide ("") vaut « absente »,
 * comme dans `.env.example`. Chaque intégration est un groupe : soit toutes
 * ses variables sont renseignées (intégration active), soit aucune
 * (intégration désactivée proprement). Un groupe à moitié rempli fait
 * échouer le démarrage (instrumentation.ts) pour qu'un déploiement mal
 * configuré se voie tout de suite.
 */

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), schema.optional());

const url = z.url({ protocol: /^https?$/, error: "URL http(s) attendue." });

const schema = z.object({
  NODE_ENV: optional(z.enum(["development", "production", "test"])),
  DATABASE_URL: z.string({ error: "DATABASE_URL manquante." }).min(1, "DATABASE_URL manquante."),
  DIRECT_URL: optional(z.string()),
  SESSION_SECRET: z.string({ error: "SESSION_SECRET manquant." }).min(32, "SESSION_SECRET : 32 caractères minimum."),
  /** Adresse publique de l'outil (liens dans les e-mails, ICS, webhooks). */
  APP_URL: optional(url).transform((value) => (value ?? "https://tasks.suzaliconseil.com").replace(/\/$/, "")),

  CRON_SECRET: optional(z.string().min(16, "CRON_SECRET : 16 caractères minimum.")),
  /** Ping de surveillance après chaque passage du cron (healthchecks.io, Sentry Crons…). */
  HEARTBEAT_URL: optional(url),

  SENTRY_DSN: optional(url),
  SENTRY_ENVIRONMENT: optional(z.string()),
});

export type Env = z.infer<typeof schema>;

/** Intégrations : variables requises ensemble. */
export const INTEGRATION_GROUPS = {
  cron: ["CRON_SECRET"],
  sentry: ["SENTRY_DSN"],
} as const satisfies Record<string, readonly (keyof Env)[]>;

export type Integration = keyof typeof INTEGRATION_GROUPS;

export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Configuration invalide :\n- ${problems.join("\n- ")}`);
    this.name = "EnvError";
  }
}

/** Valide un ensemble de variables (pur : testable avec n'importe quelle source). */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  const problems = result.success
    ? []
    : result.error.issues.map((issue) => `${issue.path.join(".")} : ${issue.message}`);

  for (const [name, keys] of Object.entries(INTEGRATION_GROUPS) as [string, readonly string[]][]) {
    const present = keys.filter((key) => (source[key] ?? "").trim() !== "");
    if (present.length > 0 && present.length < keys.length) {
      const missing = keys.filter((key) => !present.includes(key));
      problems.push(`${name} : ${missing.join(", ")} manquant(s) (les autres variables du groupe sont renseignées).`);
    }
  }
  if (problems.length || !result.success) throw new EnvError(problems);
  return result.data;
}

let cached: Env | undefined;

/** Variables validées du processus (mises en cache). */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

/** Vrai si toutes les variables de l'intégration sont présentes. */
export function integrationEnabled(name: Integration, env: Env = getEnv()): boolean {
  return INTEGRATION_GROUPS[name].every((key) => env[key as keyof Env] !== undefined);
}

/** Réservé aux tests. */
export function resetEnvCache() {
  cached = undefined;
}
