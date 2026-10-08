"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Floating } from "@/components/ui/floating";
import { IconButton } from "@/components/ui/button";
import {
  addDaysISO,
  monthGrid,
  parseDateInput,
  parseISODate,
  quickPicks,
  type ISODate,
} from "@/lib/date-picker";
import { formatParis, fromParisDateTimeInput, toParisDateInput } from "@/lib/time";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

/** Midi à Paris du jour : formatParis n’affiche jamais la veille ou le lendemain. */
const dateOf = (value: ISODate) => fromParisDateTimeInput(`${value}T12:00`);

/**
 * Sélecteur de date : raccourcis (Aujourd’hui, Demain, Lundi, +1 sem, Aucune), grille du mois
 * au clavier (flèches, Entrée) et champ texte qui comprend la saisie rapide (« demain »,
 * « +3j », « 12/10 »). Valeur = `yyyy-MM-dd` comme un <input type="date">, jours en heure de
 * Paris. Avec `name`, un champ caché permet l’envoi dans un formulaire.
 */
export function DatePicker({
  value,
  onChange,
  name,
  id,
  label,
  placeholder = "Aucune date",
  size = "md",
  className,
  disabled,
}: {
  value: ISODate | null;
  onChange: (value: ISODate | null) => void;
  name?: string;
  id?: string;
  /** Nom accessible du bouton (« Échéance »). */
  label: string;
  placeholder?: string;
  size?: "md" | "lg";
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const popoverId = useId();

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) anchor?.focus();
  };
  const choose = (next: ISODate | null) => {
    onChange(next);
    close();
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <button
        ref={setAnchor}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex w-full items-center gap-2 border border-line bg-surface-2 text-left text-ink outline-hidden transition-colors",
          "hover:border-line-strong focus-visible:border-accent focus-visible:shadow-[var(--ring)] disabled:opacity-45 aria-expanded:border-accent",
          size === "lg" ? "h-10 rounded-md px-3.5 text-body" : "h-8 rounded-md px-3 text-ui",
          className,
        )}
      >
        <CalendarDays className="size-3.5 shrink-0 text-faint" />
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-faint")}>
          {value && parseISODate(value) ? formatParis(dateOf(value), "EEE d MMM yyyy") : placeholder}
        </span>
      </button>
      <Floating
        anchor={anchor}
        open={open}
        onDismiss={() => close(false)}
        id={popoverId}
        role="dialog"
        aria-label={label}
        className="animate-pop-in w-[17.5rem] rounded-lg border border-line bg-surface p-3 shadow-pop"
      >
        <Panel value={value} onChoose={choose} />
      </Floating>
    </>
  );
}

function Panel({ value, onChoose }: { value: ISODate | null; onChoose: (value: ISODate | null) => void }) {
  const [today] = useState(() => toParisDateInput(Date.now()));
  const initial = value && parseISODate(value) ? value : today;
  const [focused, setFocused] = useState<ISODate>(initial);
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);
  const grid = useRef<HTMLDivElement>(null);

  const view = parseISODate(focused)!;
  const weeks = monthGrid(view.y, view.m);

  const moveFocus = (next: ISODate) => {
    setFocused(next);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-date="${next}"]`)?.focus());
  };
  const shiftMonth = (delta: number) => {
    const date = new Date(Date.UTC(view.y, view.m - 1 + delta, 1));
    const iso = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01` as ISODate;
    setFocused(iso);
  };

  const onGridKey = (event: React.KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in steps) {
      event.preventDefault();
      moveFocus(addDaysISO(focused, steps[event.key]));
    } else if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      moveFocus(addDaysISO(focused, event.key === "PageDown" ? 30 : -30));
    }
  };

  const submitText = () => {
    const parsed = parseDateInput(text, today);
    if (parsed === undefined) {
      setInvalid(true);
      return;
    }
    onChoose(parsed);
  };

  return (
    <div className="space-y-3">
      <div>
        <input
          autoFocus
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitText();
            }
          }}
          aria-label="Saisir une date"
          aria-invalid={invalid || undefined}
          placeholder="demain, +3j, 12/10…"
          className="h-8 w-full rounded-md border border-line bg-surface-2 px-3 text-ui outline-hidden placeholder:text-faint focus-visible:border-accent focus-visible:shadow-[var(--ring)] aria-invalid:border-danger pointer-coarse:text-[16px]"
        />
        {invalid && (
          <p role="alert" className="mt-1 text-xs text-danger-text">
            Date non reconnue. Essayez « demain », « lundi », « +3j » ou « 12/10 ».
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {quickPicks(today).map((pick) => (
          <button
            key={pick.label}
            type="button"
            onClick={() => onChoose(pick.value)}
            className={cn(
              "rounded-sm border px-2 py-1 text-xs font-medium outline-hidden transition-colors focus-visible:shadow-[var(--ring)]",
              pick.value && pick.value === value ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
            )}
          >
            {pick.label}
          </button>
        ))}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p aria-live="polite" className="text-ui font-semibold capitalize">
            {formatParis(dateOf(focused), "LLLL yyyy")}
          </p>
          <div className="flex gap-0.5">
            <IconButton label="Mois précédent" size="sm" onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="size-4" />
            </IconButton>
            <IconButton label="Mois suivant" size="sm" onClick={() => shiftMonth(1)}>
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        </div>
        <div ref={grid} role="grid" aria-label={formatParis(dateOf(focused), "LLLL yyyy")} onKeyDown={onGridKey}>
          <div role="row" className="grid grid-cols-7">
            {WEEKDAYS.map((day) => (
              <span key={day} role="columnheader" className="py-1 text-center text-meta font-medium text-muted">
                {day}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div role="row" key={week[0].value} className="grid grid-cols-7">
              {week.map((day) => {
                const selected = day.value === value;
                return (
                  <button
                    key={day.value}
                    type="button"
                    role="gridcell"
                    data-date={day.value}
                    aria-selected={selected}
                    aria-current={day.value === today ? "date" : undefined}
                    aria-label={formatParis(dateOf(day.value), "EEEE d MMMM yyyy")}
                    tabIndex={day.value === focused ? 0 : -1}
                    onClick={() => onChoose(day.value)}
                    onFocus={() => setFocused(day.value)}
                    className={cn(
                      "tabular mx-auto my-px grid size-8 place-items-center rounded-md text-xs outline-hidden transition-colors focus-visible:shadow-[var(--ring)]",
                      selected
                        ? "bg-accent font-semibold text-accent-ink"
                        : day.inMonth
                          ? "text-ink hover:bg-sunken"
                          : "text-muted hover:bg-sunken",
                      !selected && day.value === today && "font-semibold text-accent ring-1 ring-accent/40",
                    )}
                  >
                    {day.day}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
