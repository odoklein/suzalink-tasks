"use server";

import { cookies } from "next/headers";

import { verifySession } from "@/lib/dal";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

/** Enregistre le thème choisi (cookie d’un an, lu par le layout racine). */
export async function setTheme(value: string) {
  await verifySession();
  const theme = parseTheme(value);
  const store = await cookies();
  if (theme === "system") store.delete(THEME_COOKIE);
  else store.set(THEME_COOKIE, theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return { ok: true as const, theme };
}
