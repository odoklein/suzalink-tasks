import type { Instrumentation } from "next";

/**
 * Démarrage du serveur : valide l'environnement (un déploiement mal
 * configuré échoue tout de suite) et branche Sentry si SENTRY_DSN est défini.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv } = await import("@/lib/env");
  const env = getEnv();
  if (env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
      // Erreurs seulement, pas de traces. Les données personnelles (cookies,
      // corps de requête) restent exclues : c'est le comportement par défaut.
      tracesSampleRate: 0,
    });
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.SENTRY_DSN) return;
  const [Sentry, { errorTags }] = await Promise.all([import("@sentry/nextjs"), import("@/lib/observability")]);
  const tags = errorTags(request.path);
  Sentry.withScope((scope) => {
    scope.setTag("via", tags.via);
    if (tags.projectKey) scope.setTag("projectKey", tags.projectKey);
    Sentry.captureRequestError(error, request, context);
  });
};
