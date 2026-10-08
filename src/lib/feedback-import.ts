import type { TaskStatus } from "@prisma/client";

import { formatParis, fromParisDateTimeInput } from "@/lib/time";

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
 * Affectation des colonnes d'un tableau collé. Les index valent -1 quand la
 * colonne est absente. `hasHeader` : la première ligne est une ligne d'en-têtes.
 */
export type ColumnMapping = {
  hasHeader: boolean;
  date: number;
  page: number;
  retour: number;
  etat: number;
  comments: number[];
};

export type DetectedTable = {
  rows: string[][];
  mapping: ColumnMapping;
  /** Libellés de la première ligne (ou « Colonne A »… sans en-tête), pour les listes du mappeur. */
  headers: string[];
  columnCount: number;
  /** Vrai quand l'affectation est une supposition (pas d'en-tête reconnu, ou colonne Retour introuvable). */
  ambiguous: boolean;
};

/** « A », « B »… « Z », « AA » : lettre de colonne façon tableur. */
export function columnLetter(index: number): string {
  let n = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

// Synonymes d'en-têtes (comparés après normalisation, sur le début du libellé).
const DATE_HEADERS = ["date", "recu"];
const PAGE_HEADERS = ["page", "ecran", "zone", "section"];
const RETOUR_HEADERS = ["retour", "demande", "modification", "feedback"];
const RETOUR_FALLBACK_HEADERS = ["commentaire client", "remarque client"];
const ETAT_HEADERS = ["etat", "statut", "avancement"];

const findHeader = (header: string[], names: string[], skip: ReadonlySet<number> = new Set()) =>
  header.findIndex((cell, index) => !skip.has(index) && names.some((name) => cell.startsWith(name)));

/** Repère les colonnes d'un collage de tableur à partir de ses en-têtes. */
export function detectTable(text: string): DetectedTable {
  const rows = parseTsv(text);
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (rows.length === 0) {
    return {
      rows,
      columnCount,
      headers: [],
      ambiguous: true,
      mapping: { hasHeader: false, date: -1, page: -1, retour: -1, etat: -1, comments: [] },
    };
  }

  const header = rows[0].map(norm);
  const page = findHeader(header, PAGE_HEADERS);
  let retour = findHeader(header, RETOUR_HEADERS, new Set([page]));
  if (retour === -1) retour = findHeader(header, RETOUR_FALLBACK_HEADERS, new Set([page]));
  const hasHeader = retour !== -1 || page !== -1;

  if (!hasHeader) {
    const etat = rows[0].length - 1;
    return {
      rows,
      columnCount,
      headers: Array.from({ length: columnCount }, (_, index) => `Colonne ${columnLetter(index)}`),
      ambiguous: true,
      mapping: {
        hasHeader: false,
        date: 0,
        page: 1,
        retour: 2,
        etat,
        comments: [3, 4].filter((index) => index !== etat && index < columnCount),
      },
    };
  }

  const etat = findHeader(header, ETAT_HEADERS, new Set([page, retour]));
  const date = findHeader(header, DATE_HEADERS, new Set([page, retour, etat]));
  const comments = header
    .map((cell, index) => (cell.startsWith("commentaire") && index !== retour && index !== etat ? index : -1))
    .filter((index) => index !== -1);

  return {
    rows,
    columnCount,
    headers: Array.from({ length: columnCount }, (_, index) => rows[0][index]?.trim() || `Colonne ${columnLetter(index)}`),
    ambiguous: retour === -1,
    mapping: { hasHeader: true, date, page, retour, etat, comments },
  };
}

/** Applique une affectation de colonnes aux lignes déjà découpées. */
export function parseFeedbackRows(rows: string[][], mapping: ColumnMapping): ImportedRow[] {
  const body = mapping.hasHeader ? rows.slice(1) : rows;
  const cell = (cells: string[], index: number) => (index >= 0 ? cells[index] : undefined);

  return body
    .map((cells) => {
      const title = clean(cell(cells, mapping.retour));
      if (!title) return null;
      const description = mapping.comments
        .map((index) => clean(cells[index]))
        .filter((value) => value && value !== title)
        .join("\n");
      let status = statusFromLabel(cell(cells, mapping.etat));
      // « Pas fait » + commentaire « en attente des visuels client » : la balle est chez le client.
      if (status === "TODO" && /attente/i.test(description)) status = "WAITING_CLIENT";
      return {
        title: title.length > 180 ? `${title.slice(0, 177)}…` : title,
        zone: clean(cell(cells, mapping.page)),
        description:
          [title.length > 180 ? title : "", description].filter(Boolean).join("\n\n") || undefined,
        status,
        date: clean(cell(cells, mapping.date)),
      } satisfies ImportedRow;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

/**
 * Transforme un tableau de retours client (Date · Page · Retour · Commentaire · État)
 * en tâches. Les en-têtes sont reconnus par leur nom (et leurs synonymes) ; sans
 * en-tête, l'ordre Date, Page, Retour, Commentaire…, État est supposé. Passez
 * `mapping` pour imposer l'affectation choisie dans le mappeur de colonnes.
 */
export function parseFeedbackTable(text: string, mapping?: ColumnMapping): ImportedRow[] {
  const detected = detectTable(text);
  if (detected.rows.length === 0) return [];
  return parseFeedbackRows(detected.rows, mapping ?? detected.mapping);
}

/**
 * Le texte collé ressemble-t-il à un tableau copié depuis un tableur ?
 * Au moins 2 lignes d'au moins 2 colonnes séparées par des tabulations.
 */
export function looksLikeTable(text: string): boolean {
  if (!text.includes("\t")) return false;
  const rows = parseTsv(text);
  return rows.length >= 2 && rows.slice(0, 2).every((row) => row.length >= 2);
}

/**
 * Lit une date de tableur : `05/10`, `5/10/2026`, `05/10/26` ou `2026-10-05`.
 * Sans année, on prend la dernière occurrence qui n'est pas dans le futur
 * (à une semaine près). Renvoie minuit à Paris, ou null si la date n'existe pas.
 */
export function parseSheetDate(value: string | undefined, now: Date = new Date()): Date | null {
  const text = value?.trim();
  if (!text) return null;
  let day: number;
  let month: number;
  let year: number | null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const fr = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?(?!\d)/.exec(text);
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (fr) {
    day = Number(fr[1]);
    month = Number(fr[2]);
    year = fr[3] ? (fr[3].length === 2 ? 2000 + Number(fr[3]) : Number(fr[3])) : null;
  } else {
    return null;
  }

  const build = (y: number) => {
    const probe = new Date(Date.UTC(y, month - 1, day));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
    return fromParisDateTimeInput(`${String(y).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00`);
  };

  if (year !== null) return build(year);
  const nowYear = Number(formatParis(now, "yyyy"));
  const current = build(nowYear);
  if (current && current.getTime() > now.getTime() + 7 * 86_400_000) return build(nowYear - 1);
  return current;
}
