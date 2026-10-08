"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { setWaitingDetails } from "@/app/actions/chasing";
import { CHASE_AFTER_DAYS } from "@/lib/chasing";
import { toParisDateInput } from "@/lib/time";
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
          toast.success(`${target.ref} : relance notée`);
          close();
        });
      }}
      className="animate-pop-in fixed bottom-20 left-1/2 z-[70] w-[min(92vw,520px)] -translate-x-1/2 rounded-xl border border-line bg-surface p-3 shadow-pop"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[12px] font-medium text-ink-2">
          <span className="font-mono text-muted">{target.ref}</span> est chez le client
        </p>
        <button type="button" onClick={close} aria-label="Fermer" className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-[12px] text-muted">
          On attend
          <input
            value={waitingFor}
            onChange={(event) => setWaitingFor(event.target.value)}
            placeholder="visuels HD, textes de la page À propos…"
            className="mt-1 w-full rounded-md border border-line bg-surface-2 px-2 py-1.5 text-[13px] text-ink"
          />
        </label>
        <label className="text-[12px] text-muted">
          Relancer le
          <input
            type="date"
            value={followUpAt}
            onChange={(event) => setFollowUpAt(event.target.value)}
            className="mt-1 block rounded-md border border-line bg-surface-2 px-2 py-1.5 text-[13px] text-ink"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink px-3 py-1.5 text-[13px] font-semibold text-bg disabled:opacity-50"
        >
          Noter
        </button>
      </div>
    </form>
  );
}
