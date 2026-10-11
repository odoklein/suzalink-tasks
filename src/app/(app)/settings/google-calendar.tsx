"use client";

import { CalendarClock, Unplug } from "lucide-react";
import { useState } from "react";

import { disconnectGoogle } from "@/app/actions/meetings";
import { Dialog } from "@/components/dialog";
import { LocalTime } from "@/components/local-time";
import { useMeetingAction } from "@/components/meetings/use-meeting-action";
import { Button, buttonClass } from "@/components/ui/button";
import { GOOGLE_OUTCOMES } from "@/lib/meetings/labels";
import { cn } from "@/lib/utils";

type Account = { email: string; calendarSyncedAt: Date | null; lastError: string | null; reconnectRequired: boolean };

/** Paramètres › Google Agenda : un compte par membre, en lecture seule. */
export function GoogleCalendarSettings({ enabled, account, outcome }: { enabled: boolean; account: Account | null; outcome: string | null }) {
  const { pending, run } = useMeetingAction();
  const [confirm, setConfirm] = useState(false);
  const message = outcome ? GOOGLE_OUTCOMES[outcome] : undefined;

  return (
    <div className="mt-3 space-y-3">
      {message && (
        <p
          role="status"
          className={cn(
            "rounded-lg border px-4 py-3 text-ui text-ink",
            message.tone === "done" ? "border-done/40 bg-done-soft" : "border-danger/40 bg-danger-soft",
          )}
        >
          {message.text}
        </p>
      )}

      {!enabled ? (
        <p className="text-ui text-muted">
          Pas encore configuré sur ce serveur : un administrateur doit renseigner GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et TOKEN_ENC_KEY.
        </p>
      ) : !account ? (
        <a href="/api/auth/google" className={buttonClass({ variant: "primary" })}>
          <CalendarClock className="size-4" /> Connecter Google Agenda
        </a>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="min-w-0 flex-1 text-ui">
              <span className="font-medium text-ink">{account.email}</span>
              <span className="block text-meta text-muted">
                {account.calendarSyncedAt ? (
                  <>
                    Dernière lecture de l’agenda <LocalTime date={account.calendarSyncedAt} relative />
                  </>
                ) : (
                  "Première lecture de l’agenda en cours…"
                )}
              </span>
            </p>
            {account.reconnectRequired && (
              <a href="/api/auth/google" className={buttonClass({ variant: "primary", size: "sm" })}>
                Reconnecter
              </a>
            )}
            <Button size="sm" variant="ghost" icon={<Unplug className="size-3.5" />} onClick={() => setConfirm(true)}>
              Déconnecter
            </Button>
          </div>
          {(account.reconnectRequired || account.lastError) && (
            <p className="text-meta text-danger-text">
              {account.reconnectRequired ? "L’accès a été retiré chez Google : reconnectez le compte." : `Dernière erreur : ${account.lastError}`}
            </p>
          )}
        </>
      )}

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Déconnecter Google Agenda ?"
        description="L’accès est révoqué chez Google. Les enregistrements prévus de vos réunions à venir sont retirés ; les comptes rendus passés restent."
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Annuler</Button>
            <Button variant="danger" loading={pending} onClick={() => run(() => disconnectGoogle(), "Agenda Google déconnecté", () => setConfirm(false))}>
              Déconnecter
            </Button>
          </>
        }
      >
        <p className="text-ui text-ink-2">Vous pourrez le reconnecter à tout moment.</p>
      </Dialog>
    </div>
  );
}
