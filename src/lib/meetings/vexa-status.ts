import type { CaptureStatus } from "@prisma/client";

/**
 * États d'une réunion chez Vexa (v0.12, `MeetingStatus` et `completion_reason`)
 * → état de capture de Suzali, avec la raison d'un échec en français. Module pur.
 */

export type VexaState = { status: string; completion_reason?: string | null; failure_stage?: string | null };

const FAILURES: Record<string, string> = {
  awaiting_admission_timeout: "Le robot n’a pas été admis dans la réunion à temps.",
  awaiting_admission_rejected: "Le robot a été refusé à l’entrée de la réunion.",
  join_failure: "Le robot n’a pas pu rejoindre la réunion (lien ou code refusé).",
  auth_session_missing: "Le robot n’a pas pu rejoindre la réunion (connexion requise par la plateforme).",
  validation_error: "Le lien de la réunion n’a pas été accepté par le serveur d’enregistrement.",
  startup_alone: "Personne n’était dans la réunion : le robot est reparti.",
  stopped_before_admission: "Enregistrement arrêté avant l’entrée du robot.",
  stopped_with_no_audio: "Aucun son n’a été enregistré.",
};

export function captureStatusFrom(state: VexaState): { status: CaptureStatus; error: string | null } | null {
  switch (state.status) {
    case "idle":
    case "scheduled":
    case "requested":
    case "joining":
      return { status: "JOINING", error: null };
    case "awaiting_admission":
      return { status: "WAITING_ADMISSION", error: null };
    case "active":
    case "needs_human_help":
    case "needs_help":
    case "stopping":
      return { status: "RECORDING", error: null };
    case "completed": {
      const failure = state.completion_reason ? FAILURES[state.completion_reason] : undefined;
      // stopped, left_alone, evicted, max_bot_time_exceeded : la réunion a bien été enregistrée.
      return failure ? { status: "FAILED", error: failure } : { status: "ENDED", error: null };
    }
    case "failed":
      return {
        status: "FAILED",
        error: state.failure_stage === "active" ? "Le robot s’est arrêté en pleine réunion." : "Le robot n’a pas pu rejoindre la réunion.",
      };
    default:
      // État inconnu (version plus récente de Vexa) : on garde l'état actuel.
      return null;
  }
}

/** Le robot est encore dans la réunion (ou en route). */
export const isLive = (status: CaptureStatus) => status === "JOINING" || status === "WAITING_ADMISSION" || status === "RECORDING";
