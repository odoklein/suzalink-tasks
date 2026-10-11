import type { NextConfig } from "next";

// Image Docker (Dokploy) : `BUILD_STANDALONE=1` dans le Dockerfile. Sans la
// variable (Netlify, développement), la sortie reste celle par défaut.
const standalone = process.env.BUILD_STANDALONE === "1";

const nextConfig: NextConfig = {
  ...(standalone
    ? {
        output: "standalone" as const,
        // Moteur Prisma : copié dans l'image même si le traçage des fichiers le manque.
        outputFileTracingIncludes: { "/**": ["./node_modules/.prisma/client/**/*"] },
      }
    : {}),
  experimental: {
    // Le cache disque de Turbopack conserve les variables d'environnement
    // (DATABASE_URL, SESSION_SECRET) dans .next/ : le scan de secrets de
    // Netlify bloque alors le déploiement. Aucun des deux caches n'est écrit.
    turbopackFileSystemCacheForBuild: false,
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
