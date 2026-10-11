import "server-only";

import type { MeetingPlatform } from "@prisma/client";

import { getEnv, integrationEnabled } from "@/lib/env";

/**
 * Adaptateur du robot Vexa auto-hébergé (API v0.12, en-tête X-API-Key).
 * Seul fichier qui connaît les URL et les formats de Vexa : le reste de
 * l'application parle en `CaptureStatus` (voir vexa-status.ts).
 */

export type VexaMeeting = {
  id: number;
  platform: string;
  native_meeting_id: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  completion_reason: string | null;
  failure_stage: string | null;
};

export type VexaSegment = {
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
  completed?: boolean;
  absolute_start_time?: string | null;
};

const PLATFORM: Record<MeetingPlatform, string> = { GOOGLE_MEET: "google_meet", TEAMS: "teams", ZOOM: "zoom" };

export class VexaError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "VexaError";
  }
}

export const vexaEnabled = () => integrationEnabled("vexa");

function config() {
  const env = getEnv();
  if (!env.VEXA_API_URL || !env.VEXA_API_KEY) throw new Error("Serveur d’enregistrement non configuré (VEXA_API_URL, VEXA_API_KEY).");
  return { base: env.VEXA_API_URL, key: env.VEXA_API_KEY };
}

async function call(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<Response> {
  const { base, key } = config();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { "x-api-key": key, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new VexaError(`Vexa ${init.method ?? "GET"} ${path.split("?")[0]} : ${response.status} ${detail.slice(0, 300)}`.trim(), response.status);
  }
  return response;
}

const json = async <T>(path: string, init?: RequestInit) => (await (await call(path, init)).json()) as T;

/** Arrêts automatiques du robot (millisecondes). */
const AUTOMATIC_LEAVE = {
  max_wait_for_admission: 10 * 60_000,
  max_time_left_alone: 3 * 60_000,
  max_bot_time: 4 * 3600_000,
};

/**
 * Envoie le robot. Le son n'est gardé que si Mistral doit transcrire après
 * la réunion ; sinon Vexa transcrit en direct et aucun audio n'est stocké.
 */
export async function sendBot(input: {
  platform: MeetingPlatform;
  nativeMeetingId: string;
  url: string;
  passcode: string | null;
  transcribeLive: boolean;
}): Promise<VexaMeeting> {
  const env = getEnv();
  const host = new URL(input.url).host;
  return json<VexaMeeting>("/bots", {
    method: "POST",
    body: JSON.stringify({
      platform: PLATFORM[input.platform],
      native_meeting_id: input.nativeMeetingId,
      meeting_url: input.url,
      ...(input.passcode ? { passcode: input.passcode } : {}),
      ...(host === "teams.live.com" ? { teams_base_host: "teams.live.com" } : {}),
      bot_name: env.VEXA_BOT_NAME,
      language: "fr",
      transcribe_enabled: input.transcribeLive,
      recording_enabled: !input.transcribeLive,
      automatic_leave: AUTOMATIC_LEAVE,
    }),
  });
}

/** Une réunion chez Vexa, par son identifiant. */
export const getVexaMeeting = (id: number) => json<VexaMeeting>(`/meetings/${id}`);

/** Robots en cours (demandés, en route, en salle d'attente, actifs, en arrêt). */
export async function runningBots(): Promise<VexaMeeting[]> {
  const body = await json<{ running?: VexaMeeting[]; running_bots?: VexaMeeting[] }>("/bots/status");
  return body.running ?? body.running_bots ?? [];
}

/** Fait sortir le robot. Rien d'actif chez Vexa (404) : déjà parti. */
export async function stopBot(platform: MeetingPlatform, nativeMeetingId: string) {
  try {
    await call(`/bots/${PLATFORM[platform]}/${encodeURIComponent(nativeMeetingId)}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof VexaError && error.status === 404) return;
    throw error;
  }
}

/** Transcription d'une réunion précise (et non la dernière du même lien). */
export async function getTranscript(id: number): Promise<VexaSegment[]> {
  const body = await json<{ segments?: VexaSegment[] }>(`/transcripts/by-id/${id}`);
  return body.segments ?? [];
}

type RecordingList = {
  recordings: {
    id: number;
    status: string;
    duration_seconds: number | null;
    media_files: { id: number; type: string; format: string; duration_seconds: number | null }[];
  }[];
};

/** Enregistrement audio d'une réunion (quand Mistral transcrit). Null s'il n'est pas encore prêt. */
export async function getAudioRecording(meetingId: number) {
  const { recordings } = await json<RecordingList>(`/recordings?meeting_id=${meetingId}&limit=5`);
  const recording = recordings.find((item) => item.media_files.some((file) => file.type === "audio"));
  const media = recording?.media_files.find((file) => file.type === "audio");
  if (!recording || !media) return null;
  const response = await call(`/recordings/${recording.id}/media/${media.id}/raw`, {}, 120_000);
  return {
    recordingId: recording.id,
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? (media.format === "wav" ? "audio/wav" : "audio/webm"),
    format: media.format,
    durationSeconds: media.duration_seconds ?? recording.duration_seconds,
  };
}

/** Supprime un enregistrement (rétention). 404 : déjà supprimé. */
export async function deleteRecording(recordingId: number) {
  try {
    await call(`/recordings/${recordingId}`, { method: "DELETE" });
  } catch (error) {
    if (error instanceof VexaError && error.status === 404) return;
    throw error;
  }
}
