"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** Adresse email affichée, avec un bouton pour la copier. */
export function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copie impossible : sélectionnez l’adresse et copiez-la à la main.");
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copier l’adresse ${email}`}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-muted hover:bg-sunken hover:text-ink"
    >
      <span className="max-w-[16rem] truncate">{email}</span>
      {copied ? <Check className="size-3 text-st-done" aria-hidden /> : <Copy className="size-3" aria-hidden />}
    </button>
  );
}
