import { PrismaClient, Priority, TaskStatus, RoundStatus, Channel, MessageKind } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("=== Import des retours Maxime Clauzel & Mise à jour 'À valider' ===");

  // 1. Trouver l'utilisateur Odo Klein
  const odo = await db.user.findFirst({
    where: { email: "odo@suzaliconseil.com" },
  });
  if (!odo) throw new Error("Utilisateur Odo introuvable");

  // 2. Trouver le projet Certif ID
  const project = await db.project.findFirst({
    where: { OR: [{ slug: "certif-id-ephoto-ants" }, { key: "EPHOTO" }] },
    include: { client: true, deliveries: true, milestones: true, zones: true },
  });
  if (!project) throw new Error("Projet EPHOTO introuvable");
  console.log("Projet trouvé:", project.name, "(id:", project.id, ")");

  // 3. Contacts client : Maxime Clauzel (Mirax) & Peter-Gabriel Sanchez (Certif ID)
  if (project.clientId) {
    await db.client.update({
      where: { id: project.clientId },
      data: {
        contacts: "Maxime Clauzel (Mirax), Peter-Gabriel Sanchez (Certif ID Photo)",
        notes: "Partenaire : Maxime Clauzel (Mirax - Lyon). Client final : Peter-Gabriel Sanchez (Certif ID Photo). Plateforme de conformité ANTS.",
      },
    });

    // Contact Maxime Clauzel
    let maxime = await db.contact.findFirst({
      where: { email: "emc@mirax.fr" },
    });
    if (!maxime) {
      maxime = await db.contact.create({
        data: {
          clientId: project.clientId,
          name: "Maxime Clauzel",
          role: "Consultant IT / Partenaire Mirax",
          email: "emc@mirax.fr",
          phone: "06 34 05 07 51",
          isPrimary: true,
        },
      });
      console.log("Créé contact Maxime Clauzel:", maxime.id);
    } else {
      console.log("Contact Maxime Clauzel existant:", maxime.id);
    }

    // Contact Peter-Gabriel Sanchez
    let gabriel = await db.contact.findFirst({
      where: { email: "contact@certif-idphoto.fr" },
    });
    if (!gabriel) {
      gabriel = await db.contact.create({
        data: {
          clientId: project.clientId,
          name: "Peter-Gabriel Sanchez",
          role: "Fondateur Certif ID Photo",
          email: "contact@certif-idphoto.fr",
          isPrimary: false,
        },
      });
      console.log("Créé contact Peter-Gabriel Sanchez:", gabriel.id);
    } else {
      console.log("Contact Peter-Gabriel Sanchez existant:", gabriel.id);
    }

    // 4. Créer les FeedbackRounds (Lots de retours Maxime Clauzel)
    const deliveries = await db.delivery.findMany({
      where: { projectId: project.id },
      orderBy: { deployedAt: "asc" },
    });
    const del1 = deliveries.find((d) => d.title.includes("v1.0"));
    const del15 = deliveries.find((d) => d.title.includes("v1.5"));
    const del2 = deliveries.find((d) => d.title.includes("v2.0"));

    // Round 1 : 28/07 Signatures fond sombre
    let round1 = await db.feedbackRound.findFirst({
      where: { projectId: project.id, label: { contains: "28/07" } },
    });
    if (!round1) {
      round1 = await db.feedbackRound.create({
        data: {
          projectId: project.id,
          label: "Retours Maxime Clauzel — 28/07 (Signatures fond sombre & inversion)",
          receivedAt: new Date("2026-07-28T12:17:00Z"),
          channel: Channel.EMAIL,
          status: RoundStatus.CLOSED,
          fromContactId: maxime.id,
          closedById: del1?.id ?? null,
          rawText: `De: CLAUZEL <emc@mirax.fr>\nDate: 28 juillet 2026 à 12:17\nÀ: Odo Klein <odosuzali@gmail.com>\n\nHello Odo,\nLe client a effectué des tests de son côté et a identifié que les signatures blanches sur fond noir ne fonctionnent pas.\nBien à vous,\nMaxime CLAUZEL`,
        },
      });
      console.log("Créé lot de retours 1 (28/07):", round1.id);
    }

    // Round 2 : 31/07 Normes ANTS & Cadrage
    let round2 = await db.feedbackRound.findFirst({
      where: { projectId: project.id, label: { contains: "31/07" } },
    });
    if (!round2) {
      round2 = await db.feedbackRound.create({
        data: {
          projectId: project.id,
          label: "Retours Maxime Clauzel — 31/07 (Normes ANTS, fond uni & ratio 32-36mm)",
          receivedAt: new Date("2026-07-31T11:21:00Z"),
          channel: Channel.EMAIL,
          status: RoundStatus.CLOSED,
          fromContactId: maxime.id,
          closedById: del1?.id ?? null,
          rawText: `De: CLAUZEL <emc@mirax.fr>\nDate: 31 juillet 2026 à 11:21\nÀ: Odo Klein <odosuzali@gmail.com>\n\nBonjour Odo,\nMerci pour ton travail, c’est vraiment top !\nConcernant la photo d'identité, il manque le détourage de la personne mise sur un fond uni couleur claire.\nVoici les normes à respecter pour l’ANTS :\nService Public : https://www.service-public.gouv.fr/particuliers/vosdroits/F10619\nLégifrance : Arrêté du 10 avril 2007 (spécifications techniques).`,
        },
      });
      console.log("Créé lot de retours 2 (31/07):", round2.id);
    }

    // Round 3 : 03/08 Fond #d4d7d3, Carnation & Oreilles visibles
    let round3 = await db.feedbackRound.findFirst({
      where: { projectId: project.id, label: { contains: "03/08" } },
    });
    if (!round3) {
      round3 = await db.feedbackRound.create({
        data: {
          projectId: project.id,
          label: "Retours Maxime Clauzel — 03/08 (Fond #d4d7d3, carnation & oreilles visibles)",
          receivedAt: new Date("2026-08-03T15:20:00Z"),
          channel: Channel.EMAIL,
          status: RoundStatus.CLOSED,
          fromContactId: maxime.id,
          closedById: del1?.id ?? null,
          rawText: `De: CLAUZEL <emc@mirax.fr>\nDate: 3 août 2026 à 15:20\nÀ: Odo Klein <odosuzali@gmail.com>\n\nVoici quelques bugs et ajustements constatés avec le panneau de contrôle :\n1. Le fond doit correspondre à ce code couleur : #d4d7d3. (Demande du client).\n2. Les couleurs du visage ont été modifiées. L'idée est de conserver les couleurs naturelles du visage.\n3. L’image traitée ne correspond pas exactement à l’originale.\n4. La signature n’a pas été reconnue sur un exemple (fichiers IMG_5444...).\n5. Ajouter un contrôle indiquant que les oreilles sont bien visibles affiché en vert dans le dashboard.`,
        },
      });
      console.log("Créé lot de retours 3 (03/08):", round3.id);
    }

    // 5. Nouvelles tâches détaillées issues spécifiquement de ces retours
    const phase1 = project.milestones.find((m) => m.name.includes("Phase 1"));
    const zoneRD = project.zones.find((z) => z.name.includes("R&D / Algorithmes"));
    const zoneIA = project.zones.find((z) => z.name.includes("IA / Biométrie"));
    const zoneBack = project.zones.find((z) => z.name.includes("Backend"));

    const newRetoursTasks = [
      {
        number: 16,
        title: "Contrôle biométrique de visibilité des oreilles (Face Mesh & checks ANTS)",
        description: "Demande expresse de Maxime Clauzel suite aux retours client du 03/08 : ajout d'un check biométrique vérifiant le dégagement des oreilles, affiché en vert dans les contrôles automatiques.",
        priority: Priority.HIGH,
        zone: "IA / Biométrie",
        zoneId: zoneIA?.id,
        milestoneId: phase1?.id,
        roundId: round3.id,
        source: "Retours Maxime Clauzel 03/08",
        deliveryId: del1?.id,
      },
      {
        number: 17,
        title: "Préservation de la carnation naturelle et adoucissement du filtre de lissage",
        description: "Ajustement de l'algorithme de normalisation pour éviter de modifier les teintes naturelles de peau et préserver la conformité stricte ANTS sans altération artificielle.",
        priority: Priority.HIGH,
        zone: "R&D / Algorithmes",
        zoneId: zoneRD?.id,
        milestoneId: phase1?.id,
        roundId: round3.id,
        source: "Retours Maxime Clauzel 03/08",
        deliveryId: del1?.id,
      },
      {
        number: 18,
        title: "Outil en ligne de test d'échantillons de signatures (20 signatures de validation)",
        description: "Mise en place de l'outil de test en direct pour permettre à Maxime Clauzel et son client de valider l'échantillon des 20 signatures de test avant passage en production.",
        priority: Priority.MEDIUM,
        zone: "Backend / Microservice",
        zoneId: zoneBack?.id,
        milestoneId: phase1?.id,
        roundId: round1.id,
        source: "Échanges Maxime Clauzel 25-27/07",
        deliveryId: del1?.id,
      },
    ];

    for (const t of newRetoursTasks) {
      const existing = await db.task.findFirst({
        where: { projectId: project.id, number: t.number },
      });
      if (!existing) {
        await db.task.create({
          data: {
            projectId: project.id,
            number: t.number,
            title: t.title,
            description: t.description,
            status: TaskStatus.REVIEW, // 'À valider'
            priority: t.priority,
            zone: t.zone,
            zoneId: t.zoneId ?? null,
            milestoneId: t.milestoneId ?? null,
            roundId: t.roundId,
            source: t.source,
            assigneeId: odo.id,
            creatorId: odo.id,
            position: t.number * 10,
          },
        });
        console.log(`Créée tâche retour [EPHOTO-${t.number}]: ${t.title}`);
      }
    }

    // 6. Mettre à jour TOUTES les tâches du projet en statut REVIEW ('À valider') comme demandé
    const updateResult = await db.task.updateMany({
      where: { projectId: project.id },
      data: {
        status: TaskStatus.REVIEW, // 'À valider'
      },
    });
    console.log(`Tâches passées en statut 'À valider' (REVIEW) : ${updateResult.count}`);

    // Mettre à jour les rounds associés aux tâches existantes EPHOTO-3 et EPHOTO-6
    await db.task.updateMany({
      where: { projectId: project.id, number: 3 },
      data: { roundId: round1.id, source: "Retours Maxime Clauzel 28/07" },
    });
    await db.task.updateMany({
      where: { projectId: project.id, number: 6 },
      data: { roundId: round3.id, source: "Retours Maxime Clauzel 03/08" },
    });

    // 7. Lier toutes les tâches aux DeliveryTask
    const allTasks = await db.task.findMany({
      where: { projectId: project.id },
    });

    for (const task of allTasks) {
      let targetDeliveryId = del2?.id;
      if (task.number <= 7 || task.number >= 16) {
        targetDeliveryId = del1?.id;
      } else if (task.number <= 10) {
        targetDeliveryId = del15?.id;
      } else {
        targetDeliveryId = del2?.id;
      }

      if (targetDeliveryId) {
        const existingLink = await db.deliveryTask.findUnique({
          where: { deliveryId_taskId: { deliveryId: targetDeliveryId, taskId: task.id } },
        });
        if (!existingLink) {
          await db.deliveryTask.create({
            data: { deliveryId: targetDeliveryId, taskId: task.id },
          });
        }
      }
    }
    console.log("Liaisons DeliveryTask synchronisées !");

    // 8. Mettre à jour le compteur de tâches du projet
    await db.project.update({
      where: { id: project.id },
      data: {
        taskCounter: Math.max(...allTasks.map((t) => t.number)),
      },
    });
    console.log("Compteur de tâches projet mis à jour.");
  }

  console.log("\n=== MISE À JOUR TERMINÉE AVEC SUCCÈS ===");
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("ERREUR:", e);
  await db.$disconnect();
  process.exit(1);
});
