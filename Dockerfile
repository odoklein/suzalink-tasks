# Image de production (Dokploy, ou tout hôte Docker) : docs/REUNIONS-PLAN.md, M0.
# `next build` en mode « standalone » : l'image finale ne contient que le serveur
# et les fichiers qu'il charge, sans les dépendances de développement.

FROM node:20-bookworm-slim AS base
# OpenSSL : requis par le moteur de Prisma (cible debian-openssl-3.0.x).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
# `postinstall` lance `prisma generate` : le schéma doit être là avant `npm ci`.
COPY prisma ./prisma
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV BUILD_STANDALONE=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
# Arrêt propre : Next termine les requêtes en cours et les callbacks `after()` sur SIGTERM.
STOPSIGNAL SIGTERM
CMD ["node", "server.js"]
