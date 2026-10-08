import "server-only";

import { headers } from "next/headers";

import { db } from "@/lib/db";
import { clientIp } from "@/lib/request-ip";

/** Note une tentative de connexion (Paramètres › Journal). Ne fait jamais échouer la connexion. */
export async function recordLoginEvent(entry: { email: string; success: boolean; userId?: string | null; method?: "PIN" | "GOOGLE" }) {
  try {
    const list = await headers();
    await db.loginEvent.create({
      data: {
        email: entry.email.slice(0, 320),
        success: entry.success,
        userId: entry.userId ?? null,
        method: entry.method ?? "PIN",
        ip: clientIp(list),
        ua: list.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
  } catch (error) {
    console.error("login-event", error);
  }
}
