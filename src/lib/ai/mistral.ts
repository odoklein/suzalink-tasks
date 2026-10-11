import "server-only";

import type { z } from "zod";

import { getEnv } from "@/lib/env";

/**
 * Client Mistral minimal (REST, sans SDK) : sortie JSON structurée et
 * transcription Voxtral. La clé ne quitte jamais le serveur ; aucun contenu
 * n'est journalisé.
 */

const BASE = "https://api.mistral.ai/v1";
export const TRANSCRIPTION_MODEL = "voxtral-mini-latest";

export class MistralError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MistralError";
  }
}

function apiKey() {
  const key = getEnv().MISTRAL_API_KEY;
  if (!key) throw new Error("MISTRAL_API_KEY manquante.");
  return key;
}

async function failure(response: Response): Promise<never> {
  const body = (await response.json().catch(() => null)) as { message?: string; detail?: unknown } | null;
  const detail = body?.message ?? (typeof body?.detail === "string" ? body.detail : "");
  throw new MistralError(`Mistral : ${response.status}${detail ? ` ${String(detail).slice(0, 300)}` : ""}`, response.status);
}

type ChatResponse = {
  model: string;
  choices: { message: { content: string | null | { type: string; text?: string }[] }; finish_reason: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** Texte de la réponse ; les morceaux « thinking » des modèles de raisonnement sont ignorés. */
function textOf(content: ChatResponse["choices"][number]["message"]["content"]): string {
  if (typeof content === "string") return content;
  return (content ?? []).map((chunk) => (chunk.type === "text" ? (chunk.text ?? "") : "")).join("");
}

/** Réponse JSON conforme à `schema`, ou une erreur explicite. */
export async function chatJson<S extends z.ZodType>(input: {
  model?: string;
  system: string;
  user: string;
  name: string;
  schema: S;
  jsonSchema: Record<string, unknown>;
}): Promise<{ data: z.output<S>; model: string; inputTokens: number; outputTokens: number }> {
  // Mistral attend le schéma seul, sans la déclaration `$schema` du brouillon JSON Schema.
  const schema = Object.fromEntries(Object.entries(input.jsonSchema).filter(([key]) => key !== "$schema"));
  const response = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey()}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      model: input.model ?? getEnv().MISTRAL_MODEL,
      temperature: 0.1,
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
      response_format: { type: "json_schema", json_schema: { name: input.name, schema, strict: true } },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) await failure(response);
  const body = (await response.json()) as ChatResponse;
  const choice = body.choices[0];
  if (!choice) throw new Error("Mistral : réponse vide.");
  if (choice.finish_reason !== "stop") {
    throw new Error(
      choice.finish_reason === "length" || choice.finish_reason === "model_length"
        ? "Mistral : réponse coupée (trop longue)."
        : `Mistral : réponse interrompue (${choice.finish_reason}).`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(textOf(choice.message.content));
  } catch {
    throw new Error("Mistral : la réponse n’est pas du JSON valide.");
  }
  const result = input.schema.safeParse(parsed);
  if (!result.success) throw new Error("Mistral : la réponse ne respecte pas le format attendu.");
  return {
    data: result.data,
    model: body.model,
    inputTokens: body.usage?.prompt_tokens ?? 0,
    outputTokens: body.usage?.completion_tokens ?? 0,
  };
}

export type SpokenSegment = { start: number; end: number; text: string; speaker: string | null };

/**
 * Transcription Voxtral d'un fichier audio, avec séparation des voix
 * (`diarize`). La langue n'est pas imposée : Mistral refuse `language` avec
 * des horodatages. `contextBias` : noms propres et vocabulaire du projet.
 */
export async function transcribeAudio(input: {
  bytes: ArrayBuffer;
  filename: string;
  contentType: string;
  contextBias: string[];
}): Promise<{ segments: SpokenSegment[]; model: string }> {
  const form = new FormData();
  form.append("model", TRANSCRIPTION_MODEL);
  form.append("file", new Blob([input.bytes], { type: input.contentType }), input.filename);
  form.append("diarize", "true");
  form.append("timestamp_granularities", "segment");
  for (const term of input.contextBias.slice(0, 100)) form.append("context_bias", term);

  const response = await fetch(`${BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey()}`, accept: "application/json" },
    body: form,
    signal: AbortSignal.timeout(15 * 60_000),
  });
  if (!response.ok) await failure(response);
  const body = (await response.json()) as {
    model?: string;
    segments?: { text: string; start: number; end: number; speaker_id?: string | number | null }[];
  };
  return {
    model: body.model ?? TRANSCRIPTION_MODEL,
    segments: (body.segments ?? []).map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text,
      speaker: segment.speaker_id == null ? null : `Voix ${segment.speaker_id}`,
    })),
  };
}

/** Termes acceptés par `context_bias` : un mot, sans espace ni virgule. */
export function biasTerms(names: (string | null | undefined)[]): string[] {
  const terms = new Set<string>();
  for (const name of names) {
    for (const word of (name ?? "").split(/[\s,]+/)) {
      const term = word.replace(/[^\p{L}\p{N}'’-]/gu, "");
      if (term.length >= 3) terms.add(term);
    }
  }
  return [...terms].slice(0, 100);
}
