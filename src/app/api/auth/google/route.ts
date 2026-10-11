import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { randomToken } from "@/lib/crypto";
import { readSession } from "@/lib/dal";
import { db } from "@/lib/db";
import { googleClient } from "@/lib/google/accounts";
import { authorizationUrl, OAUTH_COOKIE, OAUTH_COOKIE_PATH, pkcePair } from "@/lib/google/oauth";

/**
 * « Connecter Google Agenda » (Paramètres) : prépare le flux PKCE et envoie
 * le membre connecté vers l'écran de consentement de Google.
 * Route publique dans le proxy (/api/auth/) : la session est vérifiée ici.
 */
export async function GET() {
  const session = await readSession();
  if (!session) redirect("/login?next=/settings");
  const client = googleClient();
  if (!client) redirect("/settings?google=indisponible#google");

  const user = await db.user.findUnique({ where: { id: session.userId }, select: { email: true } });
  const state = randomToken(24);
  const nonce = randomToken(24);
  const { verifier, challenge } = pkcePair();

  (await cookies()).set(OAUTH_COOKIE, JSON.stringify({ state, nonce, verifier, userId: session.userId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: 600,
  });
  redirect(authorizationUrl(client, { state, challenge, nonce, loginHint: user?.email }));
}
