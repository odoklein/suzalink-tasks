/** Libellés de touches selon le système : « Mod+Shift+K » → ⌘⇧K (Mac) ou Ctrl Maj K. */
const MAC: Record<string, string> = { mod: "⌘", ctrl: "⌃", shift: "⇧", alt: "⌥", enter: "↵", backspace: "⌫", delete: "⌦", esc: "⎋" };
const OTHER: Record<string, string> = {
  mod: "Ctrl",
  ctrl: "Ctrl",
  shift: "Maj",
  alt: "Alt",
  enter: "Entrée",
  backspace: "Retour",
  delete: "Suppr",
  esc: "Échap",
};

export function formatKeys(keys: string, mac: boolean): string {
  const table = mac ? MAC : OTHER;
  const parts = keys
    .split("+")
    .filter(Boolean)
    .map((part) => table[part.toLowerCase()] ?? (part.length === 1 ? part.toUpperCase() : part));
  return mac ? parts.join("") : parts.join(" ");
}
