/**
 * Données de départ : l'équipe et les projets en cours.
 * Relançable sans doublon : les comptes sont mis à jour par email, et un projet
 * déjà présent (même slug) n'est pas recréé.
 *
 *   SEED_PASSWORD=… npm run db:seed
 */
import { PrismaClient, type Priority, type TaskStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Adresses à ajuster si besoin : chacun se connecte avec la sienne.
const TEAM = [
  { name: "Odo Klein", email: "odo@suzaliconseil.com", color: "#2B59F2", role: "ADMIN" as const },
  { name: "Hichem Hammouche", email: "hichem@suzaliconseil.com", color: "#1D9A62", role: "ADMIN" as const },
  { name: "Amine", email: "amine@suzaliconseil.com", color: "#C98206", role: "MEMBER" as const },
  { name: "Chahinez A.", email: "chahinez@suzaliconseil.com", color: "#B04FA8", role: "MEMBER" as const },
  { name: "Anaïs Morales", email: "anais@suzaliconseil.com", color: "#E5533D", role: "MEMBER" as const },
  { name: "Biba Slimani", email: "biba@suzaliconseil.com", color: "#1F8A9E", role: "MEMBER" as const },
];

type SeedTask = {
  title: string;
  zone?: string;
  status?: TaskStatus;
  priority?: Priority;
  source?: string;
  description?: string;
  assignee?: string; // prénom
  billable?: boolean;
};

type SeedProject = {
  name: string;
  slug: string;
  key: string;
  color: string;
  client: string;
  endClient?: string;
  siteUrl?: string;
  status?: "ACTIVE" | "WAITING_CLIENT" | "PAUSED" | "DONE";
  lead: string;
  tasks: SeedTask[];
  deliveries?: { title: string; at: string; notes?: string }[];
};

const CLIENTS = [
  {
    name: "Agence 33 Degrés",
    kind: "AGENCY" as const,
    contacts: "Luna Cervi (cheffe de projet), Clémentine Burdet-Micolle (direction)",
    notes: "Les retours du client final arrivent par vagues, souvent sous forme de tableau. Confirmer chaque livraison par écrit, avec l'heure de mise en ligne.",
  },
  { name: "Web Diffusion", kind: "AGENCY" as const, contacts: "Justine Lepierre, Julien Geoffroy", notes: null },
  { name: "PicPhone", kind: "DIRECT" as const, contacts: "Sonia Djedid", notes: null },
  { name: "Cheffe Suzanne", kind: "DIRECT" as const, contacts: null, notes: "Boutique à Oran, réseaux sociaux." },
];

const LUNA = "Retours Luna 05-06/10";

const PROJECTS: SeedProject[] = [
  {
    name: "Bières Georges",
    slug: "bieres-georges",
    key: "BG",
    color: "#E8913A",
    client: "Agence 33 Degrés",
    endClient: "Bières Georges (Julien)",
    siteUrl: "https://bieres.netlify.app",
    status: "WAITING_CLIENT",
    lead: "Odo",
    tasks: [
      { title: "Remplacer le paragraphe d'intro par « Les styles de bières sont une référence… »", zone: "Bières emblématiques", status: "DONE", source: LUNA },
      { title: "Remettre le bandeau orange « Originales · Spéciales · Éditions limitées »", zone: "Bières emblématiques", status: "DONE", source: LUNA },
      { title: "Retirer les deux cartes de gammes sous le bandeau", zone: "Bières emblématiques", status: "DONE", source: LUNA },
      { title: "Libellé « Princesse » → « Princesse Pale Ale »", zone: "Bières emblématiques", status: "DONE", source: LUNA },
      { title: "6ᵉ distinction de la Pale Ale (Guide Hachette des Bières)", zone: "Bières emblématiques", status: "DONE", source: LUNA, description: "Ajoutée sur Pale Ale et Princesse Pale Ale. Visuel trop flou pour être lu : original HD demandé au client." },
      { title: "Retirer « bière précédente / suivante » des fiches", zone: "Fiche produit", status: "DONE", source: LUNA },
      { title: "Ne garder que le bloc Ingrédients (pas de fiche technique en doublon)", zone: "Fiche produit", status: "DONE", source: LUNA },
      { title: "Formats 33 cl de la Pils et de la Witbier : incohérence dans le document client", zone: "Bières emblématiques", status: "WAITING_CLIENT", source: LUNA },
      { title: "TAV de la NEIPA Exotic : 4 % ou 4-5 % ?", zone: "Bières emblématiques", status: "WAITING_CLIENT", source: LUNA },
      { title: "Visuels de bières manquants (Red Ale, Brut)", zone: "Bières emblématiques", status: "WAITING_CLIENT", source: LUNA },
      { title: "Médailles en haute définition (bière, concours, année)", zone: "Bières emblématiques", status: "WAITING_CLIENT", priority: "HIGH", source: LUNA },
      { title: "Titres de la homepage au style « Trouver les Bières Georges »", zone: "Homepage", status: "DONE", source: "Retours Luna 29/09" },
      { title: "Retirer les halos sous les bouteilles (Originales / Spéciales)", zone: "Homepage", status: "REVIEW", source: LUNA, assignee: "Odo", description: "Versions des PNG sans halo générées ; à pousser puis à vérifier sur fond orange." },
      { title: "Insérer la vidéo dans le bloc Brasserie audacieuse", zone: "Homepage", status: "DONE", source: LUNA },
      { title: "Insérer l'image tireuse", zone: "Homepage", status: "DONE", source: LUNA },
      { title: "Images Magasins / Établissements / Événements", zone: "Homepage", status: "DONE", source: LUNA },
      { title: "Nouveaux intitulés des gammes BG et Bières Georges", zone: "Homepage", status: "WAITING_CLIENT", source: LUNA, description: "Aucun nouveau nom indiqué dans le tableau : précision demandée à Luna." },
      { title: "Remplacer l'image du header", zone: "Brasserie audacieuse", status: "DONE", source: LUNA },
      { title: "Titre « Nous fabriquons des bières de caractère… » à la place du paragraphe", zone: "Brasserie audacieuse", status: "REVIEW", source: LUNA, description: "Rendu à valider : titre long, taille réduite." },
      { title: "Frise chronologique à revoir", zone: "Brasserie audacieuse", status: "WAITING_CLIENT", source: LUNA },
      { title: "Manifeste : titre « L'héritage se conjugue au présent »", zone: "Brasserie audacieuse", status: "DONE", source: LUNA },
      { title: "Valeurs : « Les ingrédients pour que la bière soit juste »", zone: "Brasserie audacieuse", status: "DONE", source: LUNA },
      { title: "Équipe : « La nouvelle garde » + retirer le paragraphe", zone: "Brasserie audacieuse", status: "DONE", source: LUNA },
      { title: "Équipe : portraits du guide de marque, alignés sous « Léa »", zone: "Brasserie audacieuse", status: "WAITING_CLIENT", source: LUNA },
    ],
    deliveries: [
      { title: "Premier lien de recette envoyé à Luna", at: "2026-06-10T11:06:00+02:00" },
      { title: "Corrections après retours du 28/08", at: "2026-09-04T17:10:00+02:00" },
      { title: "Store locator, footer, frise, savoir-faire, typographies", at: "2026-09-25T10:15:00+02:00" },
      { title: "Savoir-faire « Voir plus », première passe sur les titres", at: "2026-10-05T09:02:00+02:00" },
      { title: "Titres harmonisés, catalogue et pages produits, médailles, Red Ale et Brut", at: "2026-10-06T12:20:00+02:00" },
      { title: "Catalogue V1 et V2 enrichis, fiche produit enrichie", at: "2026-10-06T12:32:00+02:00" },
      { title: "Corrections du tableau de Luna", at: "2026-10-06T15:48:00+02:00", notes: "Textes Brasserie audacieuse, vidéo et visuels homepage, catalogue, 6ᵉ médaille Pale Ale." },
    ],
  },
  {
    name: "Crésus Paie",
    slug: "cresus-paie",
    key: "CP",
    color: "#3B6CF6",
    client: "Agence 33 Degrés",
    endClient: "Crésus Paie",
    lead: "Odo",
    tasks: [
      { title: "Ajouter un favicon", zone: "Global", source: "Mail Clémentine 07/09", assignee: "Odo" },
      { title: "Remplacer les photos libres de droits par celles du client", zone: "Global", source: "Mail Clémentine 30/07" },
    ],
  },
  {
    name: "Kiff Cleaning Solutions",
    slug: "kiff-cleaning-solutions",
    key: "KCS",
    color: "#2E9E6B",
    client: "Web Diffusion",
    lead: "Odo",
    tasks: [
      { title: "Mentions légales et politique de confidentialité : contenu à fournir", zone: "Pages légales", status: "WAITING_CLIENT", source: "Mail 01/09" },
      { title: "Basculer sur le domaine définitif après validation", zone: "Mise en ligne", source: "Mail 27/07" },
    ],
  },
  {
    name: "PicPhone",
    slug: "picphone",
    key: "PP",
    color: "#6A5AE0",
    client: "PicPhone",
    lead: "Hichem",
    tasks: [
      { title: "Nouvelle proposition de contenu et de structure", zone: "Global", status: "REVIEW", source: "Mail Anaïs 01/09", assignee: "Anaïs" },
    ],
  },
  {
    name: "Cheffe Suzanne · Instagram",
    slug: "cheffe-suzanne-instagram",
    key: "CS",
    color: "#B04FA8",
    client: "Cheffe Suzanne",
    lead: "Hichem",
    tasks: [
      { title: "Donner l'accès au compte Instagram à Biba (Drive partagé)", zone: "Instagram", priority: "HIGH", assignee: "Hichem" },
      { title: "Publier les 6 posts prêts", zone: "Instagram", status: "WAITING_CLIENT", assignee: "Biba" },
    ],
  },
];

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password || !/^\d{6}$/.test(password)) {
    throw new Error("Définissez SEED_PASSWORD (code PIN à 6 chiffres) avant de lancer le seed.");
  }
  const passwordHash = await bcrypt.hash(password, 12);

  const users = new Map<string, string>();
  for (const member of TEAM) {
    const user = await db.user.upsert({
      where: { email: member.email },
      update: { name: member.name, color: member.color, role: member.role },
      create: { ...member, passwordHash },
    });
    users.set(member.name.split(" ")[0], user.id);
  }

  const clients = new Map<string, string>();
  for (const client of CLIENTS) {
    const existing = await db.client.findFirst({ where: { name: client.name } });
    const saved = existing ?? (await db.client.create({ data: client }));
    clients.set(client.name, saved.id);
  }

  for (const project of PROJECTS) {
    if (await db.project.findUnique({ where: { slug: project.slug } })) {
      console.log(`· ${project.name} existe déjà, ignoré`);
      continue;
    }
    const leadId = users.get(project.lead) ?? null;
    const created = await db.project.create({
      data: {
        name: project.name,
        slug: project.slug,
        key: project.key,
        color: project.color,
        status: project.status ?? "ACTIVE",
        endClient: project.endClient,
        siteUrl: project.siteUrl,
        clientId: clients.get(project.client),
        leadId,
        taskCounter: project.tasks.length,
      },
    });

    const positions = new Map<TaskStatus, number>();
    for (const [index, task] of project.tasks.entries()) {
      const status = task.status ?? "TODO";
      const position = (positions.get(status) ?? 0) + 1000;
      positions.set(status, position);
      await db.task.create({
        data: {
          projectId: created.id,
          number: index + 1,
          title: task.title,
          description: task.description,
          zone: task.zone,
          source: task.source,
          status,
          priority: task.priority ?? "NONE",
          billable: task.billable ?? false,
          assigneeId: task.assignee ? (users.get(task.assignee) ?? null) : null,
          creatorId: leadId,
          position,
          completedAt: status === "DONE" ? new Date() : null,
        },
      });
    }

    for (const delivery of project.deliveries ?? []) {
      await db.delivery.create({
        data: {
          projectId: created.id,
          title: delivery.title,
          notes: delivery.notes,
          url: project.siteUrl,
          deployedAt: new Date(delivery.at),
          authorId: leadId,
        },
      });
    }

    await db.activity.create({ data: { projectId: created.id, actorId: leadId, message: "a créé le projet" } });
    console.log(`✓ ${project.name} : ${project.tasks.length} tâches, ${project.deliveries?.length ?? 0} mises en ligne`);
  }

  console.log(`\nComptes : ${TEAM.map((m) => m.email).join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
