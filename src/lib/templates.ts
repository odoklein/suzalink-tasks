import { tz } from "@date-fns/tz";
import type { ProjectType } from "@prisma/client";
import { addDays } from "date-fns";

// Import relatif : ce module est aussi chargé par prisma/seed.ts et les scripts (tsx).
import { TZ } from "./time";

/**
 * Modèles de projet (P4-09) : types, modèles fournis, saisie des tâches en
 * texte, plan de création d'un projet. Module pur.
 */

export const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "VITRINE", label: "Site vitrine" },
  { value: "ECOMMERCE", label: "E-commerce" },
  { value: "REFONTE", label: "Refonte" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "SOCIAL", label: "Réseaux sociaux" },
  { value: "OTHER", label: "Autre" },
];

export type TemplateTaskData = {
  title: string;
  zone: string | null;
  milestone: string | null;
  offsetDays: number | null;
  estimateMin: number | null;
};

export type TemplateData = {
  name: string;
  type: ProjectType;
  milestones: string[];
  zones: string[];
  tasks: TemplateTaskData[];
};

/** « 2h », « 30m », « 1j » (7 h), « 90 » (minutes) → minutes. */
export function parseEstimate(value: string | undefined): number | null {
  const text = value?.trim().toLowerCase().replace(",", ".");
  if (!text) return null;
  const match = /^(\d+(?:\.\d+)?)\s*(h|m|min|j)?$/.exec(text);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2] ?? "m";
  const minutes = unit === "h" ? n * 60 : unit === "j" ? n * 7 * 60 : n;
  return Math.round(minutes);
}

export function formatEstimate(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes % 420 === 0) return `${minutes / 420}j`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

/**
 * Une tâche par ligne : `Titre | Page | Jalon | J+3 | 2h` (seul le titre est
 * obligatoire ; « J+3 », « +3 » ou « 3 » pour l'échéance relative).
 */
export function parseTemplateTasks(text: string): TemplateTaskData[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, zone, milestone, offset, estimate] = line.split("|").map((part) => part.trim());
      const offsetMatch = /^(?:j\s*)?\+?\s*(-?\d+)$/i.exec(offset ?? "");
      return {
        title: title.slice(0, 180),
        zone: zone || null,
        milestone: milestone || null,
        offsetDays: offsetMatch ? Number(offsetMatch[1]) : null,
        estimateMin: parseEstimate(estimate),
      };
    })
    .filter((task) => task.title);
}

export function formatTemplateTasks(tasks: TemplateTaskData[]): string {
  return tasks
    .map((task) => {
      const parts = [
        task.title,
        task.zone ?? "",
        task.milestone ?? "",
        task.offsetDays !== null ? `J+${task.offsetDays}` : "",
        formatEstimate(task.estimateMin),
      ];
      while (parts.length > 1 && !parts[parts.length - 1]) parts.pop();
      return parts.join(" | ");
    })
    .join("\n");
}

/** Ajoute des jours de calendrier à Paris (le passage à l'heure d'hiver ne décale pas l'échéance). */
export function addDaysParis(date: Date, days: number): Date {
  return new Date(addDays(date, days, { in: tz(TZ) }).getTime());
}

export type ProjectPlan = {
  zones: string[];
  milestones: { name: string; position: number; dueDate: Date | null }[];
  tasks: (TemplateTaskData & { dueDate: Date | null; position: number })[];
};

/**
 * Ce que crée un modèle pour un projet démarrant le `start` (minuit à Paris) :
 * pages et jalons dédoublonnés (y compris ceux cités par les tâches), tâches à
 * échéance relative ; un jalon prend l'échéance de sa dernière tâche.
 */
export function planFromTemplate(template: TemplateData, start: Date): ProjectPlan {
  const unique = (values: (string | null)[]) => [...new Set(values.map((v) => v?.trim()).filter((v): v is string => !!v))];
  const tasks = template.tasks.map((task, index) => ({
    ...task,
    dueDate: task.offsetDays !== null ? addDaysParis(start, task.offsetDays) : null,
    position: (index + 1) * 1000,
  }));
  const milestoneNames = unique([...template.milestones, ...template.tasks.map((task) => task.milestone)]);
  return {
    zones: unique([...template.zones, ...template.tasks.map((task) => task.zone)]),
    milestones: milestoneNames.map((name, index) => {
      const dates = tasks.filter((task) => task.milestone === name && task.dueDate).map((task) => task.dueDate!.getTime());
      return { name, position: (index + 1) * 1000, dueDate: dates.length ? new Date(Math.max(...dates)) : null };
    }),
    tasks,
  };
}

const t = (line: string) => parseTemplateTasks(line)[0];

/** Modèles fournis au démarrage (seed et script prisma/scripts/seed-templates.ts). */
export const DEFAULT_TEMPLATES: TemplateData[] = [
  {
    name: "Site vitrine",
    type: "VITRINE",
    milestones: ["Cadrage", "Maquettes", "Intégration", "Recette", "Mise en ligne"],
    zones: ["Accueil", "À propos", "Services", "Contact", "Mentions légales"],
    tasks: [
      t("Recueillir les contenus et les visuels | | Cadrage | J+0 | 1h"),
      t("Arborescence et zoning | | Cadrage | J+3 | 3h"),
      t("Maquette de la page d’accueil | Accueil | Maquettes | J+7 | 1j"),
      t("Maquettes des pages intérieures | | Maquettes | J+12 | 1j"),
      t("Intégration de la page d’accueil | Accueil | Intégration | J+18 | 1j"),
      t("Intégration des pages intérieures | | Intégration | J+24 | 2j"),
      t("Formulaire de contact | Contact | Intégration | J+24 | 2h"),
      t("Mentions légales et bandeau cookies | Mentions légales | Intégration | J+25 | 1h"),
      t("Recette sur mobile et ordinateur | | Recette | J+28 | 3h"),
      t("Mise en ligne, redirections et Search Console | | Mise en ligne | J+30 | 2h"),
    ],
  },
  {
    name: "E-commerce",
    type: "ECOMMERCE",
    milestones: ["Cadrage", "Maquettes", "Catalogue", "Paiement et livraison", "Recette", "Mise en ligne"],
    zones: ["Accueil", "Catégorie", "Fiche produit", "Panier", "Tunnel de commande", "Compte client"],
    tasks: [
      t("Recueillir le catalogue (produits, prix, photos) | | Cadrage | J+0 | 2h"),
      t("Maquette de la page d’accueil | Accueil | Maquettes | J+7 | 1j"),
      t("Maquettes catégorie et fiche produit | Fiche produit | Maquettes | J+10 | 1j"),
      t("Import du catalogue | Catégorie | Catalogue | J+18 | 1j"),
      t("Fiche produit : variantes et stock | Fiche produit | Catalogue | J+20 | 4h"),
      t("Panier et codes promo | Panier | Paiement et livraison | J+24 | 4h"),
      t("Paiement en ligne (mode test puis réel) | Tunnel de commande | Paiement et livraison | J+26 | 4h"),
      t("Modes et frais de livraison | Tunnel de commande | Paiement et livraison | J+26 | 3h"),
      t("CGV, mentions légales et e-mails de commande | | Paiement et livraison | J+28 | 2h"),
      t("Commande test de bout en bout | | Recette | J+32 | 2h"),
      t("Mise en ligne et suivi des premières commandes | | Mise en ligne | J+35 | 2h"),
    ],
  },
  {
    name: "Réseaux sociaux",
    type: "SOCIAL",
    milestones: ["Stratégie", "Charte", "Calendrier", "Publication"],
    zones: ["Instagram", "Facebook", "LinkedIn"],
    tasks: [
      t("Audit des comptes existants | | Stratégie | J+0 | 2h"),
      t("Cibles, ton et piliers de contenu | | Stratégie | J+3 | 3h"),
      t("Gabarits de publication et de story | Instagram | Charte | J+7 | 4h"),
      t("Calendrier éditorial du mois | | Calendrier | J+10 | 3h"),
      t("Validation du calendrier par le client | | Calendrier | J+12 |"),
      t("Programmation des publications | | Publication | J+14 | 2h"),
      t("Bilan mensuel (statistiques) | | Publication | J+30 | 2h"),
    ],
  },
];
