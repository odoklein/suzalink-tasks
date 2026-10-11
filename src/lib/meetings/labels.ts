import type { CaptureStatus, MeetingPlatform, ProposalBasis, ReportStatus } from "@prisma/client";

import type { Tone } from "@/components/ui/badge";

/** Libellés français et tons des états des Réunions. Module pur, partagé serveur / client. */

export const PLATFORM_LABELS: Record<MeetingPlatform, string> = {
  GOOGLE_MEET: "Google Meet",
  TEAMS: "Teams",
  ZOOM: "Zoom",
};

export const CAPTURE_LABELS: Record<CaptureStatus, { label: string; tone: Tone }> = {
  OFF: { label: "Non enregistrée", tone: "neutral" },
  APPROVED: { label: "Enregistrement prévu", tone: "accent" },
  JOINING: { label: "Robot en route", tone: "progress" },
  WAITING_ADMISSION: { label: "Robot en salle d’attente", tone: "waiting" },
  RECORDING: { label: "Enregistrement en cours", tone: "danger" },
  ENDED: { label: "Enregistrée", tone: "done" },
  FAILED: { label: "Échec de l’enregistrement", tone: "danger" },
  CANCELLED: { label: "Enregistrement retiré", tone: "neutral" },
};

export const REPORT_LABELS: Record<ReportStatus, { label: string; tone: Tone }> = {
  NONE: { label: "Pas de compte rendu", tone: "neutral" },
  TRANSCRIBING: { label: "Transcription en cours", tone: "progress" },
  EXTRACTING: { label: "Compte rendu en cours", tone: "progress" },
  READY: { label: "À revoir", tone: "waiting" },
  REVIEWED: { label: "Traité", tone: "done" },
  FAILED: { label: "Compte rendu en échec", tone: "danger" },
};

export const BASIS_LABELS: Record<ProposalBasis, { label: string; tone: Tone }> = {
  REQUESTED: { label: "Demandé par le client", tone: "accent" },
  COMMITTED: { label: "Engagement", tone: "review" },
  INFERRED: { label: "Déduit, à confirmer", tone: "neutral" },
};

/** Messages de retour de Google (Paramètres, `?google=…`). */
export const GOOGLE_OUTCOMES: Record<string, { tone: "done" | "danger"; text: string }> = {
  ok: { tone: "done", text: "Agenda Google connecté : vos réunions sont dans Réunions." },
  "gmail-ok": { tone: "done", text: "Gmail connecté (lecture seule). Les e-mails des 30 derniers jours sont lus par petits lots, en quelques minutes." },
  "gmail-refuse": { tone: "danger", text: "L’accès à Gmail n’a pas été autorisé : recommencez en cochant la case de Gmail. L’agenda, lui, reste connecté." },
  refus: { tone: "danger", text: "Connexion annulée sur l’écran de Google." },
  "agenda-refuse": { tone: "danger", text: "L’accès à l’agenda n’a pas été autorisé : reconnectez en cochant la case de l’agenda." },
  "deja-relie": { tone: "danger", text: "Ce compte Google est déjà relié à un autre membre." },
  expire: { tone: "danger", text: "La demande a expiré. Recommencez." },
  indisponible: { tone: "danger", text: "La connexion Google n’est pas configurée sur ce serveur." },
  erreur: { tone: "danger", text: "La connexion à Google a échoué. Réessayez." },
};

/** Durée lisible : « 45 min », « 1 h 15 ». */
export function formatDuration(startsAt: Date, endsAt: Date): string {
  const minutes = Math.max(0, Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}

/** Repère dans la transcription : « 04:12 », « 1:02:05 ». */
export function formatOffset(ms: number): string {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

export const EMAIL_ANALYSIS_LABELS: Record<"NONE" | "PENDING" | "READY" | "REVIEWED" | "FAILED", { label: string; tone: Tone }> = {
  NONE: { label: "Non lu par l’IA", tone: "neutral" },
  PENDING: { label: "Lecture en cours", tone: "progress" },
  READY: { label: "À revoir", tone: "waiting" },
  REVIEWED: { label: "Traité", tone: "done" },
  FAILED: { label: "Lecture en échec", tone: "danger" },
};
