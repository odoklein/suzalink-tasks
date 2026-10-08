import { bearerMatches } from "@/lib/crypto";
import { recordIntegrationSignal } from "@/lib/integration-status";
import { runTick } from "@/lib/jobs/runner";

// Appelé chaque minute par Supabase pg_cron + pg_net (voir README).
export const maxDuration = 60;

async function tick(request: Request) {
  if (!bearerMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const report = await runTick(10, Date.now() + 50_000);
    await recordIntegrationSignal(
      "cron",
      report.failed.length ? { ok: false, error: report.failed.map((f) => `${f.kind} : ${f.error}`).join(" · ") } : { ok: true },
    );
    return Response.json(report);
  } catch (error) {
    await recordIntegrationSignal("cron", { ok: false, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export const GET = tick;
export const POST = tick;
