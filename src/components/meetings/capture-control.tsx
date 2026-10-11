"use client";

import type { CaptureStatus } from "@prisma/client";
import { Circle, Square } from "lucide-react";
import { useState } from "react";

import { approveRecording, withdrawRecording } from "@/app/actions/meetings";
import { Dialog } from "@/components/dialog";
import { useMeetingAction } from "@/components/meetings/use-meeting-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { quote } from "@/lib/fr";
import { CAPTURE_LABELS } from "@/lib/meetings/labels";

const LIVE: CaptureStatus[] = ["JOINING", "WAITING_ADMISSION", "RECORDING"];

/**
 * Décision d'enregistrer une réunion. Rien ne part sans cette validation, et la
 * fenêtre rappelle de prévenir les participants avant la réunion.
 */
export function CaptureControl({
  meetingId,
  status,
  ended,
  canManage,
  botName,
}: {
  meetingId: string;
  status: CaptureStatus;
  /** La réunion est terminée : plus rien à décider. */
  ended: boolean;
  canManage: boolean;
  botName: string;
}) {
  const { pending, run } = useMeetingAction();
  const [dialog, setDialog] = useState<"approve" | "stop" | null>(null);
  const live = LIVE.includes(status);
  const state = CAPTURE_LABELS[status];
  const canApprove = !ended && (status === "OFF" || status === "CANCELLED" || status === "FAILED");

  const approve = () => run(() => approveRecording(meetingId), "Enregistrement prévu : le robot partira 2 minutes avant le début", () => setDialog(null));
  const withdraw = () =>
    run(() => withdrawRecording(meetingId), live ? "Enregistrement arrêté : rien n’a été gardé" : "Enregistrement retiré", () => setDialog(null));

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {status !== "OFF" && <Badge tone={state.tone}>{state.label}</Badge>}

      {canManage && canApprove && (
        <Button size="sm" icon={<Circle className="size-3 fill-current text-danger" />} onClick={() => setDialog("approve")} disabled={pending}>
          Enregistrer
        </Button>
      )}
      {canManage && status === "APPROVED" && (
        <Button size="sm" variant="ghost" onClick={withdraw} loading={pending}>
          Ne pas enregistrer
        </Button>
      )}
      {canManage && live && (
        <Button size="sm" variant="ghost" icon={<Square className="size-3 fill-current" />} onClick={() => setDialog("stop")} disabled={pending}>
          Arrêter
        </Button>
      )}

      <Dialog
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        title="Enregistrer cette réunion ?"
        description="Le compte rendu et les actions proposées arriveront quelques minutes après la fin."
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Annuler</Button>
            <Button variant="primary" onClick={approve} loading={pending}>
              Enregistrer la réunion
            </Button>
          </>
        }
      >
        <ul className="list-disc space-y-2 pl-5 text-ui text-ink-2">
          <li>
            Le robot {quote(botName)} rejoint la réunion 2 minutes avant le début et apparaît dans la liste des participants.
          </li>
          <li>
            <strong className="font-semibold text-ink">Prévenez les participants</strong> que la réunion sera enregistrée et transcrite.
            Si quelqu’un s’y oppose, arrêtez l’enregistrement : rien n’est gardé.
          </li>
          <li>Les actions sont seulement proposées : aucune tâche n’est créée sans votre validation.</li>
        </ul>
      </Dialog>

      <Dialog
        open={dialog === "stop"}
        onClose={() => setDialog(null)}
        title="Arrêter l’enregistrement ?"
        description="Le robot quitte la réunion. Rien de ce qui a été capté n’est transcrit ni gardé."
        footer={
          <>
            <Button onClick={() => setDialog(null)}>Continuer l’enregistrement</Button>
            <Button variant="danger" onClick={withdraw} loading={pending}>
              Arrêter et ne rien garder
            </Button>
          </>
        }
      >
        <p className="text-ui text-ink-2">À utiliser si un participant refuse d’être enregistré.</p>
      </Dialog>
    </div>
  );
}
