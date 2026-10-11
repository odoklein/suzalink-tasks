import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { getEnv } from "@/lib/env";

/**
 * Chiffrement des secrets stockés en base (jetons OAuth) : AES-256-GCM.
 * Format : `v1.<iv>.<tag>.<données>` en base64url. La version permet de
 * changer de clé plus tard sans casser les valeurs existantes.
 */
const VERSION = "v1";

function keyFrom(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("Clé de chiffrement invalide : 32 octets en base64 attendus.");
  return key;
}

export function sealWith(keyBase64: string, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(keyBase64), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function openWith(keyBase64: string, sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || data === undefined) throw new Error("Secret chiffré illisible.");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(keyBase64), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

function processKey(): string {
  const key = getEnv().TOKEN_ENC_KEY;
  if (!key) throw new Error("TOKEN_ENC_KEY manquante : impossible de chiffrer les jetons.");
  return key;
}

/** Chiffre avec TOKEN_ENC_KEY. */
export const seal = (plain: string) => sealWith(processKey(), plain);

/** Déchiffre avec TOKEN_ENC_KEY ; lève une erreur si la valeur a été altérée. */
export const open = (sealed: string) => openWith(processKey(), sealed);
