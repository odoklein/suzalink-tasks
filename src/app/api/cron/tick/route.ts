import { bearerMatches } from "@/lib/crypto";
import { getEnv } from "@/lib/env";
import { recordIntegrationSignal } from "@/lib/integration-status";
import { runTick } from "@/lib/jobs/runner";

// Appelé chaque minute par Supabase pg_cron + pg_net (voir README).
export const maxDuration = 60;

/** Battement de cœur externe (healthchecks.io, Sentry Crons…) : une alerte si le cron s'arrête. */
async function heartbeat(url: string | undefined, failed: boolean) {
  if (!url) return;
  try {
    await fetch(failed ? `${url.replace(/\/$/, "")}/fail` : url, { method: "GET", signal: AbortSignal.timeout(5000) });
  } catch {
    // Le service de surveillance ne doit jamais faire échouer le cron.
  }
}

async function tick(request: Request) {
  const env = getEnv();
  if (!bearerMatches(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const report = await runTick(10, Date.now() + 50_000);
    const failed = report.failed.length > 0;
    await recordIntegrationSignal(
      "cron",
      failed ? { ok: false, error: report.failed.map((f) => `${f.kind} : ${f.error}`).join(" · ") } : { ok: true },
    );
    await heartbeat(env.HEARTBEAT_URL, failed);
    return Response.json(report);
  } catch (error) {
    await recordIntegrationSignal("cron", { ok: false, error: error instanceof Error ? error.message : String(error) });
    await heartbeat(env.HEARTBEAT_URL, true);
    throw error;
  }
}

export const GET = tick;
export const POST = tick;
