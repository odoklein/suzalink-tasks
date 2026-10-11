"use client";

import { RefreshCw, RotateCcw } from "lucide-react";

import { refreshMyMailbox, retryEmailAnalysisAction } from "@/app/actions/emails";
import { useMeetingAction } from "@/components/meetings/use-meeting-action";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/plural";

/** Lit tout de suite un lot de la boîte Gmail du membre (sans attendre le cron). */
export function RefreshMailboxButton() {
  const { pending, run } = useMeetingAction();
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={<RefreshCw className="size-3.5" />}
      loading={pending}
      onClick={() =>
        run(
          () => refreshMyMailbox(),
          (result) => (result.remaining ? `Gmail lu : encore ${plural(result.remaining, "e-mail", "e-mails")} en attente` : "Gmail à jour"),
        )
      }
    >
      Actualiser
    </Button>
  );
}

/** « Relancer » la lecture d'un e-mail en échec. */
export function RetryAnalysisButton({ emailId }: { emailId: string }) {
  const { pending, run } = useMeetingAction();
  return (
    <Button size="sm" icon={<RotateCcw className="size-3.5" />} loading={pending} onClick={() => run(() => retryEmailAnalysisAction(emailId), "Lecture relancée")}>
      Relancer
    </Button>
  );
}
