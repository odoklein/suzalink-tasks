/** Référence de tâche : préfixe du projet + numéro, « BG-12 ». */
const REF = /^([A-Z][A-Z0-9]{0,5})-(\d{1,7})$/i;

export function parseTaskRef(value: string): { key: string; number: number } | null {
  const match = REF.exec(value.trim());
  if (!match) return null;
  return { key: match[1].toUpperCase(), number: Number(match[2]) };
}

export function isTaskRef(value: string): boolean {
  return parseTaskRef(value) !== null;
}

export function formatTaskRef(key: string, number: number): string {
  return `${key}-${number}`;
}

/** URL courte et partageable d’une tâche : /t/BG-12. */
export function taskPath(ref: string): string {
  return `/t/${encodeURIComponent(ref)}`;
}
