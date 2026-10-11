"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteMeeting, retryMeetingReport } from "@/app/actions/meetings";
import { Dialog } from "@/components/dialog";
import { useMeetingAction } from "@/components/meetings/use-meeting-action";
import { Button } from "@/components/ui/button";

/** « Relancer » un compte rendu en échec. */
export function RetryReportButton({ meetingId }: { meetingId: string }) {
  const { pending, run } = useMeetingAction();
  return (
    <Button size="sm" icon={<RotateCcw className="size-3.5" />} onClick={() => run(() => retryMeetingReport(meetingId), "Compte rendu relancé")} loading={pending}>
      Relancer
    </Button>
  );
}

/** « Supprimer la réunion » : enregistrement, transcription et compte rendu effacés ; les tâches créées restent. */
export function DeleteMeetingButton({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const { pending, run } = useMeetingAction();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={() => setOpen(true)}>
        Supprimer la réunion
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Supprimer cette réunion ?"
        description="L’enregistrement, la transcription et le compte rendu sont effacés. Les tâches déjà créées restent, avec leur citation."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={() => run(() => deleteMeeting(meetingId), "Réunion supprimée", () => router.push("/reunions"))}
            >
              Supprimer
            </Button>
          </>
        }
      >
        <p className="text-ui text-ink-2">Cette suppression est définitive.</p>
      </Dialog>
    </>
  );
}
