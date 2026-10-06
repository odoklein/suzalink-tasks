import type { TaskStatus } from "@prisma/client";

export type ImportedRow = {
  title: string;
  zone?: string;
  description?: string;
  status: TaskStatus;
  date?: string;
};

/** Découpe un collage de tableur (TSV), cellules multilignes entre guillemets comprises. */
export function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === "\t") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const norm = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** « Fait » → DONE, « Pas fait » / « À refaire » → TODO, « en attente » → WAITING_CLIENT. */
export function statusFromLabel(label: string | undefined): TaskStatus {
  const value = norm(label ?? "");
  if (!value) return "TODO";
  if (value.includes("attente")) return "WAITING_CLIENT";
  if (value.includes("valider") || value.includes("verifier")) return "REVIEW";
  if (value.includes("en cours")) return "IN_PROGRESS";
  if (value.includes("pas fait") || value.includes("refaire") || value.includes("remettre"))
    return "TODO";
  if (value === "fait" || value.startsWith("fait")) return "DONE";
  return "TODO";
}

const clean = (value: string | undefined) => value?.replace(/\s+/g, " ").trim() || undefined;

/**
 * Transforme un tableau de retours client (Date · Page · Retour · Commentaire · État)
 * en tâches. Les en-têtes sont reconnus par leur nom ; sans en-tête, l'ordre
 * Date, Page, Retour, Commentaire…, État est supposé.
 */
export function parseFeedbackTable(text: string): ImportedRow[] {
  const rows = parseTsv(text);
  if (rows.length === 0) return [];

  const header = rows[0].map(norm);
  const has = (name: string) => header.findIndex((h) => h.startsWith(name));
  const hasHeader = has("retour") !== -1 || has("page") !== -1;

  const col = hasHeader
    ? {
        date: has("date"),
        page: has("page"),
        retour: has("retour") !== -1 ? has("retour") : has("demande"),
        etat: header.findIndex((h) => h.startsWith("etat") || h.startsWith("statut")),
        comments: header
          .map((h, index) => (h.startsWith("commentaire") ? index : -1))
          .filter((index) => index !== -1),
      }
    : { date: 0, page: 1, retour: 2, etat: rows[0].length - 1, comments: [3, 4] };

  const body = hasHeader ? rows.slice(1) : rows;

  return body
    .map((cells) => {
      const title = clean(cells[col.retour]);
      if (!title) return null;
      const description = col.comments
        .map((index) => clean(cells[index]))
        .filter((value) => value && value !== title)
        .join("\n");
      let status = statusFromLabel(col.etat >= 0 ? cells[col.etat] : undefined);
      // « Pas fait » + commentaire « en attente des visuels client » : la balle est chez le client.
      if (status === "TODO" && /attente/i.test(description)) status = "WAITING_CLIENT";
      return {
        title: title.length > 180 ? `${title.slice(0, 177)}…` : title,
        zone: col.page >= 0 ? clean(cells[col.page]) : undefined,
        description:
          [title.length > 180 ? title : "", description].filter(Boolean).join("\n\n") || undefined,
        status,
        date: col.date >= 0 ? clean(cells[col.date]) : undefined,
      } satisfies ImportedRow;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}
