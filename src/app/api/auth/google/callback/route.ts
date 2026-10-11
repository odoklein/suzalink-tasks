import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { safeEqual } from "@/lib/crypto";
import { readSession } from "@/lib/dal";
import { googleClient } from "@/lib/google/accounts";
import { CALENDAR_SCOPE, exchangeCode, GMAIL_SCOPE, OAUTH_COOKIE, OAUTH_COOKIE_PATH, revokeToken, verifyIdToken } from "@/lib/google/oauth";
import { linkGoogleAccount } from "@/lib/meetings/accounts";

type Pending = { state: string; nonce: string; verifier: string; userId: string; gmail?: boolean };

function readPending(raw: string | undefined): Pending | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Pending>;
    return value.state && value.nonce && value.verifier && value.userId ? (value as Pending) : null;
  } catch {
    return null;
  }
}

/**
 * Retour de Google après le consentement. Le résultat est montré dans
 * Paramètres (`?google=…`) : ok, gmail-ok, gmail-refuse, refus, agenda-refuse, deja-relie, expire, erreur.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const store = await cookies();
  const pending = readPending(store.get(OAUTH_COOKIE)?.value);
  store.set(OAUTH_COOKIE, "", { path: OAUTH_COOKIE_PATH, maxAge: 0 });

  if (params.get("error")) redirect("/settings?google=refus#google");
  const state = params.get("state");
  const code = params.get("code");
  if (!pending || !state || !code || !safeEqual(state, pending.state)) redirect("/settings?google=expire#google");

  const session = await readSession();
  if (!session || session.userId !== pending.userId) redirect("/login?next=/settings");
  const client = googleClient();
  if (!client) redirect("/settings?google=indisponible#google");

  let outcome: string;
  try {
    const token = await exchangeCode(client, { code, verifier: pending.verifier });
    if (!token.id_token) throw new Error("Jeton d’identité absent de la réponse de Google.");
    const identity = await verifyIdToken(token.id_token, client.clientId, pending.nonce);
    const scopes = (token.scope ?? "").split(" ").filter(Boolean);
    if (!scopes.includes(CALENDAR_SCOPE)) {
      // Case « agenda » décochée sur l'écran de Google : rien à garder.
      await revokeToken(token.access_token);
      outcome = "agenda-refuse";
    } else if (!token.refresh_token) {
      outcome = "erreur";
    } else {
      outcome = await linkGoogleAccount(session.userId, {
        sub: identity.sub,
        email: identity.email,
        scopes,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresIn: token.expires_in,
      });
      // Gmail demandé : la case a-t-elle été cochée sur l'écran de Google ?
      if (outcome === "ok" && pending.gmail) outcome = scopes.includes(GMAIL_SCOPE) ? "gmail-ok" : "gmail-refuse";
    }
  } catch (error) {
    console.error("google-oauth", error);
    outcome = "erreur";
  }
  redirect(`/settings?google=${outcome}#google`);
}
