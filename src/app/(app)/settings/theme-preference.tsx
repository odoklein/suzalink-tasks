"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setTheme } from "@/app/actions/preferences";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { THEME_LABELS, themeAttribute, type Theme } from "@/lib/theme";

const ICONS: Record<Theme, React.ReactNode> = {
  system: <Monitor className="size-3.5" />,
  light: <Sun className="size-3.5" />,
  dark: <Moon className="size-3.5" />,
};

/** Système / Clair / Sombre : appliqué tout de suite, mémorisé côté serveur (cookie). */
export function ThemePreference({ initial }: { initial: Theme }) {
  const [theme, setLocal] = useState<Theme>(initial);
  const [, startTransition] = useTransition();

  const choose = (next: Theme) => {
    setLocal(next);
    const attribute = themeAttribute(next);
    if (attribute) document.documentElement.dataset.theme = attribute;
    else delete document.documentElement.dataset.theme;
    startTransition(async () => {
      try {
        await setTheme(next);
      } catch {
        toast.error("Le thème n’a pas pu être enregistré.");
      }
    });
  };

  return (
    <SegmentedControl
      label="Thème"
      value={theme}
      onChange={choose}
      options={(Object.keys(THEME_LABELS) as Theme[]).map((value) => ({ value, label: THEME_LABELS[value], icon: ICONS[value] }))}
    />
  );
}
