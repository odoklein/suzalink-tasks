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
  /** Domaine de l'agence : ses adresses sont « internes » dans les Réunions (les membres en @gmail.com aussi, par leur adresse). */
  AGENCY_DOMAIN: optional(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "AGENCY_DOMAIN : un domaine, ex. suzaliconseil.com.")).transform(
    (value) => (value ?? "suzaliconseil.com").toLowerCase(),
  ),

  CRON_SECRET: optional(z.string().min(16, "CRON_SECRET : 16 caractères minimum.")),
  /** Ping de surveillance après chaque passage du cron (healthchecks.io, Sentry Crons…). */
  HEARTBEAT_URL: optional(url),

  SENTRY_DSN: optional(url),
  SENTRY_ENVIRONMENT: optional(z.string()),

  /** Google (agenda des membres, docs/REUNIONS-PLAN.md) : client OAuth « Interne » de l'espace Workspace. */
  GOOGLE_CLIENT_ID: optional(z.string().min(10, "GOOGLE_CLIENT_ID invalide.")),
  GOOGLE_CLIENT_SECRET: optional(z.string().min(10, "GOOGLE_CLIENT_SECRET invalide.")),
  /** Clé AES-256 des jetons OAuth : 32 octets en base64 (`openssl rand -base64 32`). */
  TOKEN_ENC_KEY: optional(
    z.string().refine((value) => Buffer.from(value, "base64").length === 32, "TOKEN_ENC_KEY : 32 octets en base64 attendus."),
  ),

  /** Robot de réunion Vexa, auto-hébergé (réseau privé). */
  VEXA_API_URL: optional(url).transform((value) => value?.replace(/\/$/, "")),
  VEXA_API_KEY: optional(z.string().min(8, "VEXA_API_KEY invalide.")),
  /** Nom affiché du robot dans la réunion : il doit dire qu'il enregistre. */
  VEXA_BOT_NAME: optional(z.string().max(60)).transform((value) => value ?? "Suzali · prise de notes"),

  /** Mistral : comptes rendus et actions proposées, et transcription si MEETING_TRANSCRIPTION=mistral. */
  MISTRAL_API_KEY: optional(z.string().min(8, "MISTRAL_API_KEY invalide.")),
  MISTRAL_MODEL: optional(z.string()).transform((value) => value ?? "mistral-medium-latest"),
  /** Qui transcrit : `vexa` (service de transcription du serveur de capture) ou `mistral` (Voxtral, après la réunion). */
  MEETING_TRANSCRIPTION: optional(z.enum(["vexa", "mistral"], { error: "MEETING_TRANSCRIPTION : vexa ou mistral." })).transform(
    (value) => value ?? "vexa",
  ),
});

export type Env = z.infer<typeof schema>;

/** Intégrations : variables requises ensemble. */
export const INTEGRATION_GROUPS = {
  cron: ["CRON_SECRET"],
  sentry: ["SENTRY_DSN"],
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TOKEN_ENC_KEY"],
  vexa: ["VEXA_API_URL", "VEXA_API_KEY"],
  mistral: ["MISTRAL_API_KEY"],
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
