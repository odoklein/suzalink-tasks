import type { Priority, TaskStatus } from "@prisma/client";

import { PRIORITY_BY_VALUE, STATUS_BY_VALUE } from "@/lib/constants";
import { Chip } from "@/components/ui/chip";
import { Tooltip } from "@/components/ui/tooltip";
import { projectSwatchVars, softColor, strongColor } from "@/lib/color";
import { cn, dueTone, formatDue, initials } from "@/lib/utils";
import { waitingDays, waitingLevel } from "@/lib/waiting";

/**
 * Avatar « doux » : fond = couleur du membre diluée dans la surface, initiales en couleur
 * renforcée, pour qu’une couleur de personne ne se lise jamais comme un statut.
 * Sous 20 px, pas d’initiales : une simple forme pleine.
 */
export function Avatar({
  name,
  color,
  size = 22,
  className,
}: {
  name: string;
  color: string;
  size?: number;
  className?: string;
}) {
  const withLabel = size >= 20;
  return (
    <Tooltip content={name}>
    <span
      role="img"
      aria-label={name}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        backgroundColor: withLabel ? softColor(color) : color,
        color: withLabel ? strongColor(color) : undefined,
      }}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none",
        className,
      )}
    >
      {withLabel ? initials(name) : null}
    </span>
    </Tooltip>
  );
}

/** Avatars qui se chevauchent ; le liseré de la surface n’existe qu’ici. */
export function AvatarStack({
  people,
  size = 22,
  max = 4,
}: {
  people: { id: string; name: string; color: string }[];
  size?: number;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {shown.map((person) => (
        <Avatar key={person.id} name={person.name} color={person.color} size={size} className="ring-2 ring-surface" />
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size }}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-sunken text-meta font-semibold text-muted ring-2 ring-surface"
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

export function EmptyAvatar({ size = 22 }: { size?: number }) {
  return (
    <span
      title="Non assignée"
      style={{ width: size, height: size }}
      className="inline-flex shrink-0 rounded-full border border-dashed border-line-strong"
    />
  );
}

/**
 * Icône de statut : la forme porte l'information autant que la couleur
 * (cercle vide, demi-cercle, sablier, cercle pointillé, coche).
 */
export function StatusIcon({ status, size = 15 }: { status: TaskStatus; size?: number }) {
  const color = STATUS_BY_VALUE[status].tone;
  const common = { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true } as const;

  if (status === "DONE") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="7" fill={color} />
        <path d="M4.8 8.2 7 10.3l4.2-4.6" fill="none" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="6.2" fill="none" stroke={color} strokeWidth="1.6" />
        <path d="M8 3.6a4.4 4.4 0 0 1 0 8.8Z" fill={color} />
      </svg>
    );
  }
  if (status === "WAITING_CLIENT") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="6.2" fill="none" stroke={color} strokeWidth="1.6" />
        <path d="M5.6 4.9h4.8L8 8l2.4 3.1H5.6L8 8Z" fill={color} />
      </svg>
    );
  }
  if (status === "REVIEW") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="6.2" fill="none" stroke={color} strokeWidth="1.6" strokeDasharray="2.4 1.8" />
        <circle cx="8" cy="8" r="2.2" fill={color} />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="6.2" fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

export function StatusPill({ status }: { status: TaskStatus }) {
  const meta = STATUS_BY_VALUE[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
      style={{ borderColor: `color-mix(in srgb, ${meta.tone} 35%, transparent)`, color: meta.text }}
    >
      <StatusIcon status={status} size={12} />
      {meta.label}
    </span>
  );
}

/** Barres de priorité ; « Urgente » passe en pastille rouge. */
export function PriorityIcon({ priority, size = 14 }: { priority: Priority; size?: number }) {
  const rank = PRIORITY_BY_VALUE[priority].rank;
  if (priority === "URGENT") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-label="Priorité urgente">
        <rect x="1" y="1" width="14" height="14" rx="3.5" fill="var(--danger)" />
        <path d="M8 4.2v4.6" stroke="var(--surface)" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="8" cy="11.4" r="1.1" fill="var(--surface)" />
      </svg>
    );
  }
  if (priority === "NONE") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-label="Sans priorité">
        {[3, 7, 11].map((x) => (
          <rect key={x} x={x} y="7.2" width="2.4" height="1.6" rx="0.8" fill="var(--faint)" />
        ))}
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-label={`Priorité ${PRIORITY_BY_VALUE[priority].label.toLowerCase()}`}>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={2 + i * 4.4}
          y={10 - i * 3.4}
          width="3"
          height={4 + i * 3.4}
          rx="1"
          fill={i < rank ? "var(--ink-2)" : "var(--line-strong)"}
        />
      ))}
    </svg>
  );
}

/**
 * Échéance : en retard = danger, aujourd’hui ou demain = « soon » (orange, distinct de
 * l’ambre « chez le client »), plus tard = discret. La largeur minimale aligne la colonne
 * des échéances dans les listes ; les cartes du tableau passent min-w-0.
 */
export function DueChip({
  date,
  done = false,
  className,
}: {
  date: Date | string | null;
  done?: boolean;
  className?: string;
}) {
  if (!date) return null;
  const tone = dueTone(date, done);
  return (
    <Chip
      tone={tone === "overdue" ? "danger" : "soon"}
      muted={tone === "muted"}
      className={cn("tabular min-w-[5.25rem]", className)}
      icon={
        <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2" y="3" width="12" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      }
    >
      {formatDue(date)}
    </Chip>
  );
}

/**
 * Ancienneté chez le client, la signature du produit : 0 à 2 j discret, 3 à 4 j ambre doux,
 * 5 j et plus ambre plein, en gras, avec l’infobulle « À relancer ».
 */
export function AgeChip({ since, className }: { since: Date | string; className?: string }) {
  const days = waitingDays(since);
  const level = waitingLevel(days);
  const chip = (
    <Chip
      tone="waiting"
      variant={level === "chase" ? "solid" : "soft"}
      muted={level === "calm"}
      aria-label={days === 0 ? "Chez le client depuis aujourd’hui" : `Chez le client depuis ${days} jour${days > 1 ? "s" : ""}`}
      className={cn("tabular", level === "chase" && "font-bold", className)}
      icon={<StatusIcon status="WAITING_CLIENT" size={11} />}
    >
      {days === 0 ? "auj." : `${days} j`}
    </Chip>
  );
  return level === "chase" ? <Tooltip content="À relancer">{chip}</Tooltip> : chip;
}

export function ZoneChip({ zone }: { zone: string | null }) {
  if (!zone) return null;
  return <Chip className="max-w-[11rem] truncate">{zone}</Chip>;
}

export function BillableBadge() {
  return (
    <Tooltip content="Hors périmètre (€)">
      <span role="img" aria-label="Hors périmètre, à facturer" className="inline-flex items-center rounded-xs bg-ink px-1 text-meta font-bold text-bg">
        €
      </span>
    </Tooltip>
  );
}

/**
 * Pastille de projet. La couleur claire/sombre vient de la palette (classe project-swatch,
 * voir globals.css). Sous 20 px, pas de lettres : une forme pleine ; rayon = 28 % du côté.
 */
export function ProjectTile({ color, label, size = 20 }: { color: string; label: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        ...projectSwatchVars(color),
        width: size,
        height: size,
        fontSize: size * 0.4,
        borderRadius: Math.round(size * 0.28),
      }}
      className="project-swatch inline-flex shrink-0 items-center justify-center font-mono font-semibold tracking-tight"
    >
      {size >= 20 ? label.slice(0, 2) : null}
    </span>
  );
}

export { Kbd } from "@/components/ui/kbd";
