"use client";

import { Check, Copy, KeyRound, UserPlus } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import { addMember, resetMemberPin, type MemberState } from "@/app/actions/team";
import { fieldClass, labelClass } from "@/components/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Avatar } from "@/components/primitives";

export type Member = {
  id: string;
  name: string;
  email: string;
  color: string;
  role: "ADMIN" | "MEMBER";
  openTasks: number;
  locked: boolean;
};

type Issued = { name: string; pin: string };

export function TeamSection({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const [issued, setIssued] = useState<Issued | null>(null);
  const [pendingReset, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  const [state, action, pending] = useActionState<MemberState, FormData>(async (previous, formData) => {
    const result = await addMember(previous, formData);
    if (result?.pin && result.name) {
      setIssued({ name: result.name, pin: result.pin });
      setFormKey((key) => key + 1);
    }
    return result;
  }, undefined);

  const reset = (member: Member) =>
    startTransition(async () => {
      const result = await resetMemberPin(member.id);
      if (result?.error) toast.error(result.error);
      else if (result?.pin) setIssued({ name: member.name, pin: result.pin });
    });

  return (
    <div className="mt-4">
      {issued && <IssuedPin issued={issued} onClose={() => setIssued(null)} />}

      <ul className="divide-y divide-line rounded-md border border-line">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={member.name} color={member.color} size={28} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-ui font-medium">
                {member.name}
                {member.id === currentUserId && <span className="ml-1.5 text-meta font-normal text-muted">vous</span>}
              </p>
              <p className="truncate text-xs text-muted">{member.email}</p>
            </div>
            {member.locked && <Badge tone="danger">Bloqué</Badge>}
            <span className="hidden text-xs text-muted sm:inline">
              {member.openTasks} tâche{member.openTasks > 1 ? "s" : ""}
            </span>
            <Badge>{member.role === "ADMIN" ? "Admin" : "Membre"}</Badge>
            {member.id !== currentUserId && (
              <Tooltip content="Générer un nouveau code (code oublié ou compte bloqué)">
                <Button variant="ghost" size="sm" disabled={pendingReset} onClick={() => reset(member)} icon={<KeyRound className="size-3.5" />}>
                  <span className="hidden sm:inline">Nouveau code</span>
                </Button>
              </Tooltip>
            )}
          </li>
        ))}
      </ul>

      <form key={formKey} action={action} className="mt-4 rounded-md border border-dashed border-line-strong p-4">
        <p className="flex items-center gap-2 text-ui font-semibold">
          <UserPlus className="size-4 text-muted" /> Ajouter un membre
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <div>
            <label htmlFor="member-name" className={labelClass}>Nom</label>
            <input id="member-name" name="name" required autoComplete="off" placeholder="Prénom Nom" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="member-email" className={labelClass}>Email</label>
            <input id="member-email" name="email" type="email" required autoComplete="off" placeholder="prenom@suzaliconseil.com" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="member-role" className={labelClass}>Rôle</label>
            <select id="member-role" name="role" defaultValue="MEMBER" className={fieldClass}>
              <option value="MEMBER">Membre</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={pending}>{pending ? "Création…" : "Créer le compte"}</Button>
          <p role="status" aria-live="polite" className="text-xs text-danger-text">{state?.error}</p>
        </div>
        <p className="mt-2 text-xs text-muted">Un code à 6 chiffres est généré et affiché une seule fois : transmettez-le à la personne, elle le changera dans Paramètres.</p>
      </form>
    </div>
  );
}

function IssuedPin({ issued, onClose }: { issued: Issued; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copie impossible : notez le code à la main.");
    }
  };
  return (
    <div role="status" className="animate-pop-in mb-4 flex flex-wrap items-center gap-4 rounded-md border border-accent/40 bg-accent-soft px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-2">Code de {issued.name} : affiché une seule fois</p>
        <p className="tabular mt-0.5 font-mono text-h1 font-semibold tracking-[0.3em]">{issued.pin}</p>
      </div>
      <div className="flex gap-2">
        <Button onClick={copy} icon={copied ? <Check className="size-4 text-done-text" /> : <Copy className="size-4" />}>
          {copied ? "Copié" : "Copier"}
        </Button>
        <Button onClick={onClose}>Fermer</Button>
      </div>
    </div>
  );
}
