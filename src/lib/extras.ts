import type { ExtraStatus } from "@prisma/client";

import { plural } from "./plural";
import { formatParis } from "./time";

/**
 * Hors périmètre et avenants (P4-10) : montants, cycle de vie, message de
 * devis, export CSV. Module pur. Jamais de numérotation de facture ici :
 * la facture est émise dans l'outil comptable, on n'en garde que la référence.
 */

const NNBSP = " ";

export const EXTRA_STATUS_LABELS: Record<ExtraStatus, string> = {
  DRAFT: "Brouillon",
  QUOTED: "Devis envoyé",
  APPROVED: "Accepté",
  REJECTED: "Refusé",
  INVOICED: "Facturé",
  PAID: "Payé",
};

/** Transitions permises : brouillon → devis → accepté/refusé → facturé → payé. */
export const EXTRA_TRANSITIONS: Record<ExtraStatus, ExtraStatus[]> = {
  DRAFT: ["QUOTED"],
  QUOTED: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["INVOICED"],
  REJECTED: ["DRAFT"],
  INVOICED: ["PAID"],
  PAID: [],
};

export const canTransition = (from: ExtraStatus, to: ExtraStatus) => EXTRA_TRANSITIONS[from].includes(to);

const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 45000 → « 450 € » (espace insécable selon Intl). */
export function formatEuros(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return euros.format(cents / 100);
}

/** « 150 », « 150,50 », « 1 200 € » → centimes ; null si illisible. */
export function parseEuros(value: string | null | undefined): number | null {
  const text = value?.replace(/[\s  €]/g, "").replace(",", ".");
  if (!text) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(Number(text) * 100);
}

/** « 3 hors périmètre · 450 € · 1 à chiffrer » pour l'en-tête du projet. */
export function billableSummary(tasks: { billable: boolean; estimatedAmountCents: number | null }[]): string | null {
  const billable = tasks.filter((task) => task.billable);
  if (billable.length === 0) return null;
  const priced = billable.filter((task) => task.estimatedAmountCents !== null);
  const total = priced.reduce((sum, task) => sum + (task.estimatedAmountCents ?? 0), 0);
  const parts = [`${billable.length} hors périmètre`];
  if (priced.length) parts.push(formatEuros(total));
  const unpriced = billable.length - priced.length;
  if (unpriced) parts.push(`${unpriced} à chiffrer`);
  return parts.join(" · ");
}

export type QuoteInput = {
  contactFirstName: string | null;
  projectName: string;
  extraNumber: number;
  extraTitle: string;
  items: { title: string; zone: string | null; amountCents: number | null }[];
  amountCents: number | null;
  senderFirstName: string;
};

/** Devis d'avenant prêt à envoyer (ClientMessage QUOTE). */
export function buildQuoteMessage(input: QuoteInput): { subject: string; body: string } {
  const lines = input.items.map((item) => {
    const page = item.zone ? ` (${item.zone})` : "";
    const amount = item.amountCents !== null ? `${NNBSP}: ${formatEuros(item.amountCents)} HT` : "";
    return `- ${item.title}${page}${amount}`;
  });
  const body = [
    input.contactFirstName ? `Bonjour ${input.contactFirstName},` : "Bonjour,",
    "",
    `Voici le chiffrage des modifications demandées hors du périmètre initial de ${input.projectName}${NNBSP}:`,
    "",
    ...lines,
    "",
    input.amountCents !== null ? `Total de l’avenant n° ${input.extraNumber}${NNBSP}: ${formatEuros(input.amountCents)} HT.` : "",
    "Pouvez-vous nous confirmer votre accord par retour de mail ? Nous lancerons les modifications dès réception.",
    "",
    "Bonne journée,",
    `${input.senderFirstName} · Suzali Conseil`,
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n");
  return { subject: `${input.projectName}${NNBSP}: avenant n° ${input.extraNumber} · ${input.extraTitle}`, body };
}

export type BillingRow = {
  client: string;
  project: string;
  number: number;
  title: string;
  amountCents: number | null;
  approvedAt: Date | string | null;
  approvedBy: string | null;
};

const csvCell = (value: string) => (/[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/**
 * CSV pour l'outil comptable : séparateur « ; » et BOM UTF-8 (ouverture
 * directe dans Excel en français), montants HT en euros avec virgule.
 */
export function billingCsv(rows: BillingRow[]): string {
  const header = ["Client", "Projet", "Avenant", "Intitulé", "Montant HT (€)", "Accepté le", "Accepté par"];
  const body = rows.map((row) =>
    [
      row.client,
      row.project,
      `AV-${row.number}`,
      row.title,
      row.amountCents !== null ? (row.amountCents / 100).toFixed(2).replace(".", ",") : "",
      row.approvedAt ? formatParis(new Date(row.approvedAt), "dd/MM/yyyy") : "",
      row.approvedBy ?? "",
    ]
      .map(csvCell)
      .join(";"),
  );
  return `﻿${[header.join(";"), ...body].join("\r\n")}\r\n`;
}

/** « octobre 2026 » : regroupement mensuel de la page Facturation. */
export const monthLabel = (date: Date | string) => formatParis(new Date(date), "MMMM yyyy");

export const extrasCountLabel = (n: number) => plural(n, "avenant");
