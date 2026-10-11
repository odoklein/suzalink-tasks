import { PrismaClient, Priority, TaskStatus, ProjectType, ClientKind } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Starting insertion of Certif ID / ePhoto ANTS into Supabase...");

  // 1. Get or create Lead (Odo Klein)
  const odo = await db.user.findFirst({
    where: { email: "odo@suzaliconseil.com" },
  });
  if (!odo) {
    throw new Error("User Odo Klein not found!");
  }

  // 2. Get or create Client "Certif ID"
  let client = await db.client.findFirst({
    where: { name: "Certif ID" },
  });

  if (!client) {
    client = await db.client.create({
      data: {
        name: "Certif ID",
        kind: ClientKind.DIRECT,
        contacts: "Odo Klein (fondateur), Équipe technique Suzali",
        notes: "Plateforme agréée de photos d'identité et signatures conformes ANTS (certif-idphoto.fr) pour permis de conduire et titres sécurisés.",
      },
    });
    console.log("Created client:", client.name, "(id:", client.id, ")");
  } else {
    console.log("Found existing client:", client.name);
  }

  // 3. Check if Project already exists
  let project = await db.project.findFirst({
    where: {
      OR: [{ slug: "certif-id-ephoto-ants" }, { key: "EPHOTO" }],
    },
  });

  if (project) {
    console.log("Project already exists:", project.name, "(slug:", project.slug, ")");
  } else {
    project = await db.project.create({
      data: {
        name: "Certif ID · ePhoto ANTS",
        slug: "certif-id-ephoto-ants",
        key: "EPHOTO",
        color: "#0D9488", // Teal ANTS
        status: "ACTIVE",
        type: ProjectType.ECOMMERCE,
        siteUrl: "https://certif-idphoto.fr",
        description: "Solution complète d'ingestion native WooCommerce, préparation biométrique ANTS (OpenCV + MediaPipe Face Mesh), modération CRM et transmission ePhoto.io.",
        statusNote: "Flux de bout en bout validé : premier code officiel émis (9RQ3715DDE9BBA34C6C8CB). Système 100% natif en production.",
        statusNoteAt: new Date(),
        clientId: client.id,
        leadId: odo.id,
        startDate: new Date("2026-07-15T09:00:00Z"),
        taskCounter: 15,
      },
    });
    console.log("Created project:", project.name, "(id:", project.id, ")");
  }

  // 4. Create Zones
  const zoneNames = [
    "R&D / Algorithmes",
    "IA / Biométrie",
    "Backend / Microservice",
    "R&D / Mobile",
    "WordPress / WooCommerce",
    "WordPress / UI",
    "Intégrations / API",
    "Mise en production",
  ];

  const zoneMap: Record<string, string> = {};
  for (let i = 0; i < zoneNames.length; i++) {
    const name = zoneNames[i];
    let zone = await db.zone.findFirst({
      where: { projectId: project.id, name },
    });
    if (!zone) {
      zone = await db.zone.create({
        data: {
          name,
          position: (i + 1) * 1000,
          projectId: project.id,
        },
      });
    }
    zoneMap[name] = zone.id;
  }
  console.log("Created/verified zones:", Object.keys(zoneMap).length);

  // 5. Create Milestones (The 4 Phases)
  const milestoneDefs = [
    {
      name: "Phase 1 : Moteur OpenCV & Signature validé",
      position: 1000,
      completedAt: new Date("2026-07-28T18:00:00Z"),
      dueDate: new Date("2026-07-28T18:00:00Z"),
    },
    {
      name: "Phase 2 : IA MediaPipe Face Mesh & ANTS opérationnelle",
      position: 2000,
      completedAt: new Date("2026-08-09T18:00:00Z"),
      dueDate: new Date("2026-08-09T18:00:00Z"),
    },
    {
      name: "Phase 3 : Résolution des cas limites mobiles (EXIF & PCA)",
      position: 3000,
      completedAt: new Date("2026-10-07T10:00:00Z"),
      dueDate: new Date("2026-10-07T10:00:00Z"),
    },
    {
      name: "Phase 4 : Architecture Native WooCommerce & Prod",
      position: 4000,
      completedAt: new Date("2026-10-09T14:00:00Z"),
      dueDate: new Date("2026-10-09T14:00:00Z"),
    },
  ];

  const milestoneMap: Record<number, string> = {};
  for (let i = 0; i < milestoneDefs.length; i++) {
    const m = milestoneDefs[i];
    let ms = await db.milestone.findFirst({
      where: { projectId: project.id, name: m.name },
    });
    if (!ms) {
      ms = await db.milestone.create({
        data: {
          name: m.name,
          position: m.position,
          completedAt: m.completedAt,
          dueDate: m.dueDate,
          projectId: project.id,
        },
      });
    }
    milestoneMap[i + 1] = ms.id;
  }
  console.log("Created/verified milestones:", Object.keys(milestoneMap).length);

  // 6. Create Tasks
  const tasksData = [
    // Phase 1 : Juillet
    {
      number: 1,
      title: "R&D Algorithme d'extraction de signature et normalisation d'éclairage",
      description: "Développement de signature_validator.py : normalisation d'illumination, seuillage adaptatif contre les ombres de papier, extraction d'encre nette sans morphologie destructive.",
      zone: "R&D / Algorithmes",
      milestonePhase: 1,
      priority: Priority.HIGH,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-07-27T16:00:00Z"),
    },
    {
      number: 2,
      title: "Cadrage au ratio légal 4:1 (521×134 px) sans déformation",
      description: "Centrage et mise à l'échelle homothétique de la signature sur un canevas 521×134 px conforme aux exigences officielles de l'Imprimerie Nationale.",
      zone: "R&D / Algorithmes",
      milestonePhase: 1,
      priority: Priority.MEDIUM,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-07-28T12:00:00Z"),
    },
    {
      number: 3,
      title: "Détection et inversion automatique des signatures sur fond sombre",
      description: "Prise en charge des stylos blancs/clairs ou feuilles sombres : détection automatique et inversion (+inverted) avant le pipeline pour un rendu noir sur fond blanc standard.",
      zone: "R&D / Algorithmes",
      milestonePhase: 1,
      priority: Priority.MEDIUM,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-07-28T15:30:00Z"),
    },

    // Phase 2 : Août
    {
      number: 4,
      title: "Architecture du microservice FastAPI et stockage persistant SQLite",
      description: "Création du serveur FastAPI (service/main.py) avec base SQLite, persistance disque des originaux et sorties nettoyées, purge automatique RGPD à 30 jours.",
      zone: "Backend / Microservice",
      milestonePhase: 2,
      priority: Priority.HIGH,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-08-03T18:00:00Z"),
    },
    {
      number: 5,
      title: "Intégration MediaPipe Face Mesh (468 repères biométriques)",
      description: "Calcul algorithmique des critères officiels ANTS : hauteur de tête (70–80%), hauteur des yeux (33–50%), détection d'ouverture des yeux, bouche fermée, présence des deux oreilles et inclinaison du crâne.",
      zone: "IA / Biométrie",
      milestonePhase: 2,
      priority: Priority.URGENT,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-08-05T02:00:00Z"),
    },
    {
      number: 6,
      title: "Remplacement de fond conforme ANTS (Gris officiel #d4d7d3)",
      description: "Détourage conditionnel via MediaPipe Selfie Segmentation et remplacement par le gris officiel #d4d7d3 (le fond blanc pur étant formellement interdit par l'ANTS). Garde de sécurité pour ne pas ronger le visage.",
      zone: "IA / Biométrie",
      milestonePhase: 2,
      priority: Priority.HIGH,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-08-05T03:00:00Z"),
    },
    {
      number: 7,
      title: "Suite de tests automatisés (Smoke Tests de conformité)",
      description: "Développement de tests de non-régression end-to-end (tests/smoke_test.py) couvrant plus de 50 assertions de biométrie, ratio ANTS, payloads Make et sécurité.",
      zone: "Backend / Microservice",
      milestonePhase: 2,
      priority: Priority.MEDIUM,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-08-09T16:50:00Z"),
    },

    // Phase 3 : Septembre
    {
      number: 8,
      title: "Gestion des métadonnées d'orientation EXIF des smartphones",
      description: "Correction systématique des rotations EXIF pour les photos et signatures prises sur iPhone et Android, éliminant les images inversées ou retournées à 90°.",
      zone: "R&D / Mobile",
      milestonePhase: 3,
      priority: Priority.HIGH,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-10-07T08:50:00Z"),
    },
    {
      number: 9,
      title: "Algorithme de redressement mathématique PCA (Deskew)",
      description: "Analyse en composantes principales pour estimer précisément l'angle d'inclinaison des signatures et appliquer un redressement automatique avant recadrage.",
      zone: "R&D / Algorithmes",
      milestonePhase: 3,
      priority: Priority.HIGH,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-10-07T08:53:00Z"),
    },
    {
      number: 10,
      title: "Encodage 300 DPI pour l'export des planches d'identité",
      description: "Intégration des métadonnées de résolution 300 DPI dans les fichiers PNG et JPEG exportés pour respecter les normes de l'Imprimerie Nationale.",
      zone: "Backend / Microservice",
      milestonePhase: 3,
      priority: Priority.MEDIUM,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-10-07T08:54:00Z"),
    },

    // Phase 4 : Octobre
    {
      number: 11,
      title: "Suppression du scénario Make A & Ingestion native WooCommerce",
      description: "Lecture directe en PHP des commandes WooCommerce et extraction des téléversements TM Extra Product Options. Élimination du polling Make, des délais d'attente et des coûts d'API.",
      zone: "WordPress / WooCommerce",
      milestonePhase: 4,
      priority: Priority.URGENT,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-10-09T12:00:00Z"),
    },
    {
      number: 12,
      title: "Développement du tableau de bord de contrôle CRM natif (v2.0.0)",
      description: "Création de la page d'administration WordPress (certif-ephoto-control) avec statistiques temps réel, table des commandes ePhoto, aperçus photo/signature au survol et compatibilité HPOS.",
      zone: "WordPress / UI",
      milestonePhase: 4,
      priority: Priority.HIGH,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-10-09T12:30:00Z"),
    },
    {
      number: 13,
      title: "Boîte modale d'examen interactif (Recadrage live & rotation 1 clic)",
      description: "Interface AJAX sans rechargement de page : checklist de conformité détaillée, sliders de recadrage dynamique (zoom, dx, dy) et boutons de rotation rapide (0°, 90°, 180°, 270°).",
      zone: "WordPress / UI",
      milestonePhase: 4,
      priority: Priority.HIGH,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-10-09T13:00:00Z"),
    },
    {
      number: 14,
      title: "Scénario Make B & Connexion API ePhoto.io",
      description: "Configuration du Webhook sortant, upload S3 vers ePhoto.io, récupération du code ANTS officiel et envoi automatique de l'e-mail client via Mailjet.",
      zone: "Intégrations / API",
      milestonePhase: 4,
      priority: Priority.URGENT,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-10-09T13:45:00Z"),
    },
    {
      number: 15,
      title: "Test de validation en conditions réelles (Validation du code 9RQ3715DDE9BBA34C6C8CB)",
      description: "Validation de bout en bout sur une commande réelle certif-idphoto.fr : transmission validée, commande WooCommerce passée en terminée et code officiel ePhoto reçu par e-mail.",
      zone: "Mise en production",
      milestonePhase: 4,
      priority: Priority.HIGH,
      status: TaskStatus.DONE,
      completedAt: new Date("2026-10-09T14:06:00Z"),
    },
  ];

  for (const t of tasksData) {
    const existingTask = await db.task.findUnique({
      where: {
        projectId_number: {
          projectId: project.id,
          number: t.number,
        },
      },
    });

    const taskPayload = {
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      zone: t.zone,
      zoneId: zoneMap[t.zone] || null,
      milestoneId: milestoneMap[t.milestonePhase] || null,
      assigneeId: odo.id,
      creatorId: odo.id,
      position: t.number * 1000,
      completedAt: t.completedAt,
      statusChangedAt: t.completedAt,
    };

    if (existingTask) {
      await db.task.update({
        where: { id: existingTask.id },
        data: taskPayload,
      });
      console.log(`Updated task [EPHOTO-${t.number}]: ${t.title}`);
    } else {
      await db.task.create({
        data: {
          projectId: project.id,
          number: t.number,
          ...taskPayload,
        },
      });
      console.log(`Created task [EPHOTO-${t.number}]: ${t.title}`);
    }
  }

  // 7. Create Deliveries
  const deliveriesData = [
    {
      title: "Livraison v1.0 — Microservice FastAPI & Iframe Make",
      at: new Date("2026-08-09T17:00:00Z"),
      notes: "Premier microservice opérationnel avec MediaPipe Face Mesh et affichage dans l'administration WordPress via iframe.",
    },
    {
      title: "Livraison v1.5 — Redressement PCA & Gestion EXIF mobile",
      at: new Date("2026-10-07T09:30:00Z"),
      notes: "Correction des signatures retournées sur mobile, analyse en composantes principales pour le redressement et 300 DPI.",
    },
    {
      title: "Livraison v2.0 — Architecture 100% Native WooCommerce & ePhoto.io validé",
      at: new Date("2026-10-09T14:10:00Z"),
      notes: "Suppression du scénario Make A. Plugin natif PHP v2.0.0 avec modale CRM. Transmission ePhoto.io validée en conditions réelles (Code : 9RQ3715DDE9BBA34C6C8CB).",
    },
  ];

  for (const del of deliveriesData) {
    const existingDelivery = await db.delivery.findFirst({
      where: { projectId: project.id, title: del.title },
    });
    if (!existingDelivery) {
      await db.delivery.create({
        data: {
          title: del.title,
          notes: del.notes,
          deployedAt: del.at,
          projectId: project.id,
          authorId: odo.id,
        },
      });
      console.log("Created delivery:", del.title);
    }
  }

  console.log("\nALL PROJECT DATA & TASKS SUCCESSFULLY INSERTED INTO SUPABASE!");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("ERROR:", e);
  await db.$disconnect();
  process.exit(1);
});
