import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Le cache disque de Turbopack conserve les variables d'environnement
    // (DATABASE_URL, SESSION_SECRET) dans .next/ : le scan de secrets de
    // Netlify bloque alors le déploiement. Aucun des deux caches n'est écrit.
    turbopackFileSystemCacheForBuild: false,
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
