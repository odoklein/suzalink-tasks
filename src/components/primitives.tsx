import type { Priority, TaskStatus } from "@prisma/client";

import { PRIORITY_BY_VALUE, STATUS_BY_VALUE } from "@/lib/constants";
import { cn, dueTone, formatDue, initials } from "@/lib/utils";

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
  return (
    <span
      title={name}
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.42 }}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none text-white ring-2 ring-surface",
        className,
      )}
    >
      {initials(name)}
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
    <span
      className={cn(
        "tabular inline-flex min-w-[5.25rem] items-center gap-1 rounded-sm px-1.5 py-0.5 text-meta font-medium",
        tone === "overdue" && "bg-danger-soft text-danger-text",
        tone === "soon" && "bg-soon-soft text-soon-text",
        tone === "muted" && "text-muted",
        className,
      )}
    >
      <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2" y="3" width="12" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {formatDue(date)}
    </span>
  );
}

export function ZoneChip({ zone }: { zone: string | null }) {
  if (!zone) return null;
  return (
    <span className="inline-flex max-w-[11rem] items-center truncate rounded-sm bg-sunken px-1.5 py-0.5 text-meta font-medium text-ink-2">
      {zone}
    </span>
  );
}

export function BillableBadge() {
  return (
    <span
      role="img"
      aria-label="Hors périmètre, à facturer"
      title="Hors périmètre (€)"
      className="inline-flex items-center rounded-xs bg-ink px-1 text-meta font-bold text-bg"
    >
      €
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.25rem] items-center justify-center rounded-xs border border-line bg-surface-2 px-1 font-mono text-meta font-medium text-muted">
      {children}
    </kbd>
  );
}

export function ProjectTile({ color, label, size = 20 }: { color: string; label: string; size?: number }) {
  return (
    <span
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.4 }}
      className="inline-flex shrink-0 items-center justify-center rounded-sm font-mono font-semibold tracking-tight text-white"
    >
      {label.slice(0, 2)}
    </span>
  );
}
