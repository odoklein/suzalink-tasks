/**
 * Interlocuteurs d'un client (P4-04) : lecture de l'ancien champ libre
 * `Client.contacts`, prénom pour les salutations, contact principal. Module pur.
 */

export type ParsedContact = { name: string; role: string | null };

/**
 * « Luna Cervi (cheffe de projet), Clémentine Burdet-Micolle » devient deux
 * contacts. On sépare sur les virgules, points-virgules et retours à la ligne
 * situés hors des parenthèses (« Luna (cheffe de projet, design) » reste un seul contact).
 */
export function parseLegacyContacts(text: string | null | undefined): ParsedContact[] {
  if (!text) return [];
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of text) {
    if (char === "(") depth++;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && (char === "," || char === ";" || char === "\n")) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);

  return parts
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^(.*?)\s*\((.+)\)\s*$/.exec(part);
      const name = (match ? match[1] : part).trim();
      const role = match ? match[2].trim() : "";
      return name ? { name, role: role || null } : null;
    })
    .filter((contact): contact is ParsedContact => contact !== null);
}

/** Premier prénom : « Luna Cervi » → « Luna ». */
export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export type ContactLike = { isPrimary: boolean; createdAt: Date | string };

/** Le contact principal, sinon le plus ancien. */
export function primaryContact<T extends ContactLike>(contacts: readonly T[]): T | null {
  if (contacts.length === 0) return null;
  const flagged = contacts.find((contact) => contact.isPrimary);
  if (flagged) return flagged;
  return [...contacts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
}

export const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
