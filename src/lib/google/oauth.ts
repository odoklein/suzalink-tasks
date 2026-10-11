import "server-only";

import { createHash } from "node:crypto";

import { createRemoteJWKSet, jwtVerify } from "jose";

import { randomToken } from "@/lib/crypto";

/**
 * Connexion d'un compte Google (flux « code » avec PKCE, P7-08). REST simple,
 * sans le paquet `googleapis`. Lecture seule : l'agenda d'abord, Gmail en
 * option (second consentement). Aucun droit d'écriture ni d'envoi.
 */

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GOOGLE_SCOPES = ["openid", "email", CALENDAR_SCOPE];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type GoogleClient = { clientId: string; clientSecret: string; redirectUri: string };

/** Le jeton n'est plus valable (accès retiré, mot de passe changé…) : il faut reconnecter le compte. */
export class GoogleAuthError extends Error {
  constructor(message = "L’accès Google a été retiré : reconnectez le compte dans Paramètres.") {
    super(message);
    this.name = "GoogleAuthError";
  }
}

export const callbackPath = "/api/auth/google/callback";

/** Cookie du flux en cours (state, nonce, vérificateur PKCE), limité aux routes /api/auth/google. */
export const OAUTH_COOKIE = "suzali_google_oauth";
export const OAUTH_COOKIE_PATH = "/api/auth/google";

/** Vérificateur PKCE et son empreinte S256. */
export function pkcePair() {
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function authorizationUrl(
  client: Pick<GoogleClient, "clientId" | "redirectUri">,
  input: { state: string; challenge: string; nonce: string; loginHint?: string; gmail?: boolean },
): string {
  const params = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    response_type: "code",
    scope: [...GOOGLE_SCOPES, ...(input.gmail ? [GMAIL_SCOPE] : [])].join(" "),
    // Jeton de rafraîchissement : l'agenda est relu en tâche de fond.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
  });
  if (input.loginHint) params.set("login_hint", input.loginHint);
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
};

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await response.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
  if (!response.ok) {
    if (json.error === "invalid_grant") throw new GoogleAuthError();
    throw new Error(`Google a refusé la demande de jeton (${response.status}${json.error ? ` ${json.error}` : ""}).`);
  }
  if (!json.access_token || typeof json.expires_in !== "number") throw new Error("Réponse de Google incomplète.");
  return json as TokenResponse;
}

export function exchangeCode(client: GoogleClient, input: { code: string; verifier: string }) {
  return postToken({
    grant_type: "authorization_code",
    code: input.code,
    code_verifier: input.verifier,
    client_id: client.clientId,
    client_secret: client.clientSecret,
    redirect_uri: client.redirectUri,
  });
}

export function refreshAccessToken(client: Omit<GoogleClient, "redirectUri">, refreshToken: string) {
  return postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: client.clientId,
    client_secret: client.clientSecret,
  });
}

/** Identité du compte, d'après le jeton d'identité signé par Google. */
export async function verifyIdToken(idToken: string, clientId: string, nonce: string) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });
  if (payload.nonce !== nonce) throw new Error("Jeton d’identité Google invalide (nonce).");
  if (typeof payload.sub !== "string" || typeof payload.email !== "string" || payload.email_verified !== true) {
    throw new Error("Adresse du compte Google non vérifiée.");
  }
  return { sub: payload.sub, email: payload.email.toLowerCase() };
}

/** Révoque l'accès chez Google (déconnexion). Ne lève pas d'erreur : le compte est supprimé de toute façon. */
export async function revokeToken(token: string) {
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Google injoignable : l'accès expirera faute d'être utilisé.
  }
}
