import "server-only";

import { db } from "@/lib/db";

/** Signal reçu d'un fournisseur (webhook, cron) : alimente le panneau Intégrations. */
export async function recordIntegrationSignal(provider: string, outcome: { ok: true } | { ok: false; error: string }) {
  const now = new Date();
  const data = outcome.ok
    ? { lastReceivedAt: now, lastOkAt: now }
    : { lastReceivedAt: now, lastError: outcome.error.slice(0, 1000), lastErrorAt: now };
  try {
    await db.integrationStatus.upsert({ where: { provider }, create: { provider, ...data }, update: data });
  } catch (error) {
    // Ne jamais faire échouer un webhook parce que le suivi n'a pas pu s'écrire.
    console.error("integration-status", provider, error);
  }
}
