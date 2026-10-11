"use client";

import { Check, Mail, X } from "lucide-react";

import { reviewEmailMeetingAction } from "@/app/actions/meetings";
import { useMeetingAction } from "@/components/meetings/use-meeting-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Réunion trouvée dans un e-mail : à confirmer avant tout enregistrement, ou à ignorer. */
export function EmailMeetingReview({ meetingId, canManage }: { meetingId: string; canManage: boolean }) {
  const { pending, run } = useMeetingAction();
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      <Badge tone="waiting" icon={<Mail className="size-3" aria-hidden="true" />}>
        Trouvée dans un e-mail
      </Badge>
      {canManage && (
        <>
          <Button size="sm" icon={<Check className="size-3.5" />} onClick={() => run(() => reviewEmailMeetingAction(meetingId, true), "Réunion confirmée")} disabled={pending}>
            Confirmer
          </Button>
          <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => run(() => reviewEmailMeetingAction(meetingId, false), "Réunion ignorée")} disabled={pending}>
            Ignorer
          </Button>
        </>
      )}
    </div>
  );
}
