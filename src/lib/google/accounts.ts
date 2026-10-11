import "server-only";

import type { OAuthAccount } from "@prisma/client";

import { db } from "@/lib/db";
import { getEnv, integrationEnabled } from "@/lib/env";
import { callbackPath, GoogleAuthError, refreshAccessToken, type GoogleClient } from "@/lib/google/oauth";
import { open, seal } from "@/lib/secret-box";

/** Client OAuth configuré, ou null si l'intégration Google est désactivée. */
export function googleClient(): GoogleClient | null {
  const env = getEnv();
  if (!integrationEnabled("google", env)) return null;
  return {
    clientId: env.GOOGLE_CLIENT_ID!,
    clientSecret: env.GOOGLE_CLIENT_SECRET!,
    redirectUri: `${env.APP_URL}${callbackPath}`,
  };
}

/**
 * Jeton d'accès valable au moins une minute : celui en base s'il n'a pas
 * expiré, sinon un nouveau obtenu avec le jeton de rafraîchissement.
 * Un accès retiré chez Google est noté sur le compte puis remonté.
 */
export async function accessTokenFor(account: OAuthAccount): Promise<string> {
  if (account.accessTokenEnc && account.expiresAt && account.expiresAt.getTime() > Date.now() + 60_000) {
    return open(account.accessTokenEnc);
  }
  const client = googleClient();
  if (!client) throw new Error("Intégration Google désactivée (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENC_KEY).");
  try {
    const token = await refreshAccessToken(client, open(account.refreshTokenEnc));
    await db.oAuthAccount.update({
      where: { id: account.id },
      data: {
        accessTokenEnc: seal(token.access_token),
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        ...(token.refresh_token ? { refreshTokenEnc: seal(token.refresh_token) } : {}),
      },
    });
    return token.access_token;
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      await db.oAuthAccount.update({
        where: { id: account.id },
        data: { lastError: error.message, lastErrorAt: new Date(), reconnectRequired: true },
      });
    }
    throw error;
  }
}
