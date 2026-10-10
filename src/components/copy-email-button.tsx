"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Tooltip } from "@/components/ui/tooltip";

/** Adresse email affichée, avec un bouton pour la copier. */
export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copie impossible : sélectionnez l’adresse et copiez-la à la main.");
    }
  };

  return (
    <Tooltip content="Copier l’adresse">
      <button
        type="button"
        onClick={copy}
        aria-label={`Copier l’adresse ${email}`}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted hover:bg-sunken hover:text-ink pointer-coarse:min-h-11"
      >
        <span className="max-w-64 truncate">{email}</span>
        {copied ? <Check className="size-3 text-done-text" aria-hidden /> : <Copy className="size-3" aria-hidden />}
        <span role="status" className="sr-only">
          {copied ? "Adresse copiée" : ""}
        </span>
      </button>
    </Tooltip>
  );
}
