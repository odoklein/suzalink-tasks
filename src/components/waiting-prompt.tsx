"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { setWaitingDetails } from "@/app/actions/chasing";
import { fieldClass } from "@/components/dialog";
import { Button, IconButton } from "@/components/ui/button";
import { CHASE_AFTER_DAYS } from "@/lib/chasing";
import { NNBSP } from "@/lib/fr";
import { toParisDateInput } from "@/lib/time";
import { cn } from "@/lib/utils";
import { WAITING_PROMPT_EVENT, type WaitingPromptDetail } from "@/lib/waiting-prompt";

const IDLE_MS = 15_000;

/**
 * Petite carte non modale : « On attend : [___] · relancer le [date] ».
 * Facultative : elle disparaît seule si on n'y touche pas.
 */
export function WaitingPrompt() {
  const [target, setTarget] = useState<WaitingPromptDetail | null>(null);
  const [waitingFor, setWaitingFor] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [touched, setTouched] = useState(false);
  const [pending, startTransition] = useTransition();
  const card = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const detail = (event as CustomEvent<WaitingPromptDetail>).detail;
      setTarget(detail);
      setWaitingFor("");
      setFollowUpAt(toParisDateInput(new Date(Date.now() + CHASE_AFTER_DAYS * 86_400_000)));
      setTouched(false);
    };
    window.addEventListener(WAITING_PROMPT_EVENT, onPrompt);
    return () => window.removeEventListener(WAITING_PROMPT_EVENT, onPrompt);
  }, []);

  useEffect(() => {
    if (!target || touched) return;
    const timer = setTimeout(() => setTarget(null), IDLE_MS);
    return () => clearTimeout(timer);
  }, [target, touched]);

  if (!target) return null;

  const close = () => setTarget(null);

  return (
    <form
      ref={card}
      aria-label={`${target.ref} chez le client`}
      onFocus={() => setTouched(true)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await setWaitingDetails(target.taskId, { waitingFor, followUpAt: followUpAt || null });
          if ("error" in result && result.error) {
            toast.error(result.error);
            return;
          }
          toast.success(`${target.ref}${NNBSP}: relance notée`);
          close();
        });
      }}
      className="animate-pop-in fixed bottom-20 left-1/2 z-palette w-[min(92vw,520px)] -translate-x-1/2 rounded-xl border border-line bg-surface p-3 shadow-pop"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-2">
          <span className="font-mono text-muted">{target.ref}</span> est chez le client
        </p>
        <IconButton label="Fermer" size="sm" onClick={close}>
          <X className="size-3.5" />
        </IconButton>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-xs text-muted">
          On attend
          <input
            value={waitingFor}
            onChange={(event) => setWaitingFor(event.target.value)}
            placeholder="visuels HD, textes de la page À propos…"
            autoComplete="off"
            className={cn(fieldClass, "mt-1")}
          />
        </label>
        <label className="text-xs text-muted">
          Relancer le
          <input
            type="date"
            value={followUpAt}
            onChange={(event) => setFollowUpAt(event.target.value)}
            autoComplete="off"
            className={cn(fieldClass, "mt-1 block w-auto")}
          />
        </label>
        <Button type="submit" variant="primary" loading={pending}>
          Noter
        </Button>
      </div>
    </form>
  );
}
