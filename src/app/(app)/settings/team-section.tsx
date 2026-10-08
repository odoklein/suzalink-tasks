"use client";

import { Check, Copy, KeyRound, UserPlus } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { addMember, resetMemberPin, setMemberActive, type MemberState } from "@/app/actions/team";
import { fieldClass, labelClass } from "@/components/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Avatar } from "@/components/primitives";
import { plural } from "@/lib/plural";

export type Member = {
  id: string;
  name: string;
  email: string;
  color: string;
  role: "ADMIN" | "MEMBER";
  active: boolean;
  openTasks: number;
  locked: boolean;
};

type Issued = { name: string; pin: string; email: string };

const APP_URL = "https://tasks.suzaliconseil.com";

export function TeamSection({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const [issued, setIssued] = useState<Issued | null>(null);
  const [pendingReset, startTransition] = useTransition();
  // « Nouveau code » demande une confirmation : l'ancien code cesse de fonctionner.
  const [confirmingReset, setConfirmingReset] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  const [state, action, pending] = useActionState<MemberState, FormData>(async (previous, formData) => {
    const result = await addMember(previous, formData);
    if (result?.pin && result.name) {
      setIssued({ name: result.name, pin: result.pin, email: result.email ?? "" });
      setFormKey((key) => key + 1);
    }
    return result;
  }, undefined);

  const reset = (member: Member) =>
    startTransition(async () => {
      setConfirmingReset(null);
      const result = await resetMemberPin(member.id);
      if (result?.error) toast.error(result.error);
      else if (result?.pin) setIssued({ name: member.name, pin: result.pin, email: result.email ?? member.email });
    });

  const toggleActive = (member: Member) =>
    startTransition(async () => {
      const result = await setMemberActive(member.id, !member.active);
      if (result?.error) toast.error(result.error);
      else toast.success(member.active ? `Compte de ${member.name} désactivé, sessions fermées` : `Compte de ${member.name} réactivé`);
    });

  return (
    <div className="mt-4">
      {issued && <IssuedPin issued={issued} onClose={() => setIssued(null)} />}

      <ul className="divide-y divide-line rounded-md border border-line">
        {members.map((member) => (
          <li key={member.id} className="px-3 py-2.5">
            <div className="flex items-center gap-3">
            <Avatar name={member.name} color={member.color} size={28} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-ui font-medium">
                {member.name}
                {member.id === currentUserId && <span className="ml-1.5 text-meta font-normal text-muted">vous</span>}
              </p>
              <p className="truncate text-xs text-muted">{member.email}</p>
            </div>
            {!member.active && <Badge>Désactivé</Badge>}
            {member.locked && <Badge tone="danger">Bloqué</Badge>}
            <span className="hidden text-xs text-muted sm:inline">
              {plural(member.openTasks, "tâche")}
            </span>
            <Badge>{member.role === "ADMIN" ? "Admin" : "Membre"}</Badge>
            {member.id !== currentUserId && (
              <Tooltip content="Générer un nouveau code (code oublié ou compte bloqué)">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingReset}
                  onClick={() => setConfirmingReset(member.id)}
                  aria-expanded={confirmingReset === member.id}
                  icon={<KeyRound className="size-3.5" />}
                >
                  <span className="hidden sm:inline">Nouveau code</span>
                </Button>
              </Tooltip>
            )}
            {member.id !== currentUserId && (
              <ActiveToggle member={member} disabled={pendingReset} onConfirm={() => toggleActive(member)} />
            )}
            </div>
            {confirmingReset === member.id && (
              <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-[12px] text-ink-2">
                <span className="min-w-0 flex-1">
                  Le code actuel de {member.name.split(" ")[0]} ne fonctionnera plus. Générer un nouveau code ?
                </span>
                <button
                  type="button"
                  disabled={pendingReset}
                  onClick={() => reset(member)}
                  className="rounded-md bg-ink px-2.5 py-1 font-semibold text-bg disabled:opacity-50"
                >
                  Générer un nouveau code
                </button>
                <button type="button" onClick={() => setConfirmingReset(null)} className="rounded-md px-2 py-1 font-medium text-muted hover:text-ink">
                  Annuler
                </button>
              </div>
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
        <p className="mt-2 text-xs text-muted">Un code à 6 chiffres est généré et affiché une seule fois : transmettez-le à la personne, elle choisira son propre code à la première connexion.</p>
      </form>
    </div>
  );
}

/** Désactiver demande une confirmation (deuxième clic) ; réactiver est immédiat. */
function ActiveToggle({ member, disabled, onConfirm }: { member: Member; disabled: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(timer);
  }, [armed]);
  const confirm = () => {
    setArmed(false);
    onConfirm();
  };
  if (!member.active) {
    return (
      <button type="button" disabled={disabled} onClick={onConfirm} className="rounded-md px-2 py-1 text-[12px] font-medium text-muted hover:bg-sunken hover:text-ink disabled:opacity-50">
        Réactiver
      </button>
    );
  }
  return armed ? (
    <button type="button" disabled={disabled} onClick={confirm} className="rounded-md bg-danger px-2 py-1 text-[12px] font-semibold text-white disabled:opacity-50">
      Confirmer
    </button>
  ) : (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setArmed(true)}
      title="Le compte ne pourra plus se connecter ; ses sessions sont fermées."
      className="rounded-md px-2 py-1 text-[12px] font-medium text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
    >
      Désactiver
    </button>
  );
}

function IssuedPin({ issued, onClose }: { issued: Issued; onClose: () => void }) {
  const [copied, setCopied] = useState<"pin" | "invite" | null>(null);
  const copy = async (what: "pin" | "invite") => {
    const text =
      what === "pin"
        ? issued.pin
        : `Connectez-vous sur ${APP_URL} avec ${issued.email} et le code ${issued.pin}. Vous choisirez votre propre code à la première connexion.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
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
        <Button onClick={() => copy("pin")} icon={copied === "pin" ? <Check className="size-4 text-done-text" /> : <Copy className="size-4" />}>
          {copied === "pin" ? "Copié" : "Copier"}
        </Button>
        {issued.email && (
          <Button onClick={() => copy("invite")} icon={copied === "invite" ? <Check className="size-4 text-done-text" /> : <Copy className="size-4" />}>
            {copied === "invite" ? "Copiée" : "Copier l’invitation"}
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>Fermer</Button>
      </div>
    </div>
  );
}
