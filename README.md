# Suzali Tasks

Gestion de projets et de tâches de l'agence Suzali Conseil, prévue sur **projets.suzaliconseil.com**.

Pensée pour la façon dont les projets clients se déroulent vraiment :

- **Retours en un collage** : copiez un tableau de retours client (Date · Page · Retour · Commentaire · État) depuis Google Sheets, chaque ligne devient une tâche, avec sa page et son statut.
- **« En attente client »** est un statut à part entière : on voit d'un coup d'œil ce qui est bloqué chez le client, et depuis combien de jours.
- **Mises en ligne datées** : chaque livraison est enregistrée à l'heure près. C'est l'historique qui prouve ce qui a été livré, et quand.
- **Récap client** : un message prêt à envoyer (fait / en attente de votre côté / en cours), généré depuis une date ou depuis la dernière mise en ligne.
- **Hors périmètre (€)** : les modifications à facturer en supplément sont marquées et comptées par projet.
- **Point d'étape** par projet : en deux phrases, où on en est et la prochaine action. Il apparaît sur la page Projets (regroupés par état : en cours, en attente client, en pause, livrés) et dans « Aujourd'hui ».
- **« Aujourd'hui » pour toute l'équipe** : mes tâches, les tâches **à attribuer**, la charge de chacun, et les projets **à relancer** (un client qui bloque depuis 5 jours ou plus).
- **Équipe gérée dans l'outil** : un administrateur ajoute un membre ou redonne un code depuis **Paramètres › Équipe**, sans toucher au code.
- **Saisie rapide** partout : `Retirer l'ombre @odo !haute #homepage demain $`, et la palette `Ctrl K` pour aller n'importe où ou créer une tâche.

## Stack

Next.js 16 (App Router, Server Actions) · Prisma 6 · PostgreSQL (Supabase) · sessions signées (jose) · Tailwind CSS 4 · dnd-kit · cmdk.

Indépendant du CRM Captain Prospect : base et comptes séparés.

## Installation

```bash
npm install
cp .env.example .env   # puis remplir les valeurs
npm run db:push        # crée les tables dans la base
npm run db:seed        # équipe + projets en cours (SEED_PASSWORD requis)
npm run dev
```

Variables (voir `.env.example`) :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion Postgres poolée (Supabase, port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Connexion directe (port 5432), utilisée par `db:push` |
| `SESSION_SECRET` | Clé de signature des sessions, 32 caractères aléatoires minimum |
| `SEED_PASSWORD` | Mot de passe initial des comptes créés par le seed (10 caractères minimum) |

Les adresses des comptes de départ sont dans `prisma/seed.ts` (`TEAM`). Ensuite, tout se gère dans l'outil : **Paramètres › Équipe** (réservé aux administrateurs) pour ajouter un membre ou générer un nouveau code, et chacun change son propre code dans **Paramètres**.

### Sécurité de la base (Supabase)

Les tables sont dans le schéma `public` : sans « Row Level Security », quiconque possède l'URL du projet et la clé publique (`anon`) peut les lire via l'API REST de Supabase, y compris les codes PIN hachés. L'application se connecte avec Prisma (rôle `postgres`, qui ignore la RLS), donc activer la RLS ne change rien à son fonctionnement et ferme cet accès :

```sql
alter table "User" enable row level security;
alter table "Client" enable row level security;
alter table "Project" enable row level security;
alter table "Task" enable row level security;
alter table "Comment" enable row level security;
alter table "Delivery" enable row level security;
alter table "Activity" enable row level security;
alter table "Event" enable row level security;
alter table "Job" enable row level security;
alter table "IntegrationStatus" enable row level security;
alter table "LoginEvent" enable row level security;
alter table "RateLimit" enable row level security;
alter table "OAuthAccount" enable row level security;
alter table "AiRun" enable row level security;
alter table "Meeting" enable row level security;
alter table "MeetingSegment" enable row level security;
alter table "MeetingProposal" enable row level security;
alter table "EmailMessage" enable row level security;
alter table "EmailProposal" enable row level security;
alter table "EmailSender" enable row level security;
```

Chaque nouvelle table ajoutée par la suite doit recevoir la même ligne.

## Mise en ligne sur projets.suzaliconseil.com

1. **Base** : créer un projet Supabase, récupérer les deux chaînes de connexion, lancer `npm run db:push` puis `npm run db:seed` en local avec ces valeurs.
2. **Hébergement** (Netlify, comme les autres sites, ou Vercel) : importer le dépôt, commande de build `npm run build`, et renseigner `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` dans les variables d'environnement.
3. **Domaine** : ajouter `projets.suzaliconseil.com` comme domaine personnalisé, puis créer chez le registrar de suzaliconseil.com un enregistrement **CNAME** `projets` → l'adresse fournie par l'hébergeur (ex. `suzali-tasks.netlify.app`). Le HTTPS est activé automatiquement.

### Sur un VPS avec Dokploy

Les Réunions ont besoin d'un serveur qui tourne en continu (transcription et compte rendu peuvent dépasser la minute) : Dokploy plutôt que Netlify.

1. Dans Dokploy, créer une **Application** depuis le dépôt Git, type de build **Dockerfile** (`Dockerfile` à la racine : `next build` en mode « standalone », `BUILD_STANDALONE=1`), port **3000**.
2. Renseigner les variables d'environnement (liste dans `.env.example`), puis le domaine `projets.suzaliconseil.com` avec HTTPS (Let's Encrypt). Faire pointer l'enregistrement DNS `projets` vers l'IP du VPS (enregistrement **A**).
3. Le cron ne change pas : pg_cron appelle `https://projets.suzaliconseil.com/api/cron/tick` (section suivante). À défaut, une tâche planifiée Dokploy (« Schedule » de type Application, `* * * * *`) peut lancer dans le conteneur `node -e "fetch('http://localhost:3000/api/cron/tick',{method:'POST',headers:{authorization:'Bearer '+process.env.CRON_SECRET}})"`.
4. Une seule instance de l'application : au-delà, voir `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md` (clé `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, cache partagé).

## Tâches de fond (cron)

Les travaux de fond (distribution des événements, relances, e-mails, synchronisations) passent par la table `Job`, consommée par `POST /api/cron/tick` (Bearer `CRON_SECRET`). Le déclencheur est **Supabase pg_cron + pg_net** (identique sur Netlify et Vercel). À exécuter une fois dans l'éditeur SQL de Supabase, en remplaçant le secret :

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Le secret reste dans Supabase Vault, jamais en clair dans la tâche.
select vault.create_secret('<valeur de CRON_SECRET>', 'cron_secret');

select cron.schedule(
  'suzali-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://projets.suzaliconseil.com/api/cron/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);
```

Suivi : **Paramètres › Intégrations** (administrateurs) montre le dernier passage du cron, les derniers webhooks reçus et les travaux en échec (bouton « Relancer »). Pour arrêter : `select cron.unschedule('suzali-tick');`.

## Réunions (Google Agenda, robot Vexa, Mistral)

Plan complet et décisions : `docs/REUNIONS-PLAN.md`. Chaque partie s'active seule, dès que ses variables sont renseignées.

1. **Google Agenda** (lecture seule).
   - Dans Google Cloud : activer l'**API Google Calendar**, puis configurer l'écran de consentement OAuth en type **Externe** (tout compte Google, @gmail.com compris). Dans **Google Auth Platform › Audience**, cliquer sur **Publier l'application** : en mode « Test », seuls les testeurs déclarés peuvent se connecter et leurs autorisations expirent au bout de 7 jours. Tant que l'application n'est pas validée par Google, chacun voit l'avertissement « Google n'a pas validé cette application » (Paramètres avancés › Accéder à…), dans la limite de 100 comptes ; la validation (page d'accueil, règles de confidentialité, vidéo de démonstration pour le champ d'accès agenda) le retire.
   - Créer un identifiant **ID client OAuth** de type « Application Web », URI de redirection autorisée : `https://projets.suzaliconseil.com/api/auth/google/callback`.
   - Variables : `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENC_KEY`, et `AGENCY_DOMAIN` si le domaine n'est pas suzaliconseil.com (les membres connectés avec une adresse @gmail.com sont reconnus comme internes par leur adresse) (`openssl rand -base64 32` ; la changer rend illisibles les jetons déjà enregistrés : chacun devra reconnecter son agenda).
   - Chaque membre connecte son agenda dans **Paramètres › Google Agenda**. L'agenda est relu toutes les 5 minutes, sur 30 jours.
2. **Robot d'enregistrement Vexa**, sur son propre VPS (les navigateurs du robot consomment beaucoup pendant les réunions).
   - Installer une version **épinglée** de [Vexa](https://github.com/Vexa-ai/vexa) (Docker ≥ 26, Ubuntu 24.04) ; la passerelle écoute sur le port **18056**. Créer une clé d'API avec l'API d'administration de Vexa ; le jeton d'administration reste sur ce serveur.
   - Ne pas exposer Vexa sur Internet : réseau privé entre les deux VPS (WireGuard, Tailscale) ou pare-feu n'acceptant que l'IP du VPS de l'application.
   - Variables : `VEXA_API_URL` (ex. `http://10.0.0.2:18056`), `VEXA_API_KEY`, `VEXA_BOT_NAME` (facultatif, « Suzali · prise de notes » par défaut).
3. **Transcription et compte rendu (Mistral).**
   - `MISTRAL_API_KEY` ; `MISTRAL_MODEL` (facultatif, `mistral-medium-latest` par défaut). Demander la **conservation zéro** (« zero data retention ») sur le compte Mistral : sinon les échanges sont gardés 30 jours par Mistral.
   - `MEETING_TRANSCRIPTION` : `vexa` (par défaut ; Vexa transcrit en direct avec son service de transcription, qui demande un GPU, et aucun audio n'est gardé) ou `mistral` (Vexa enregistre seulement l'audio ; Voxtral transcrit après la réunion, sans GPU, les voix sont nommées « Voix 1, 2… »).
4. **Gmail (facultatif, page E-mails).**
   - Dans Google Cloud : activer l'**API Gmail**, et ajouter le champ d'accès `.../auth/gmail.readonly` à l'écran de consentement (Accès aux données). C'est un champ « restreint » : tant que l'application n'est pas validée par Google, l'avertissement reste affiché et la limite de 100 comptes s'applique ; la validation complète demande une évaluation de sécurité (payante).
   - Chaque membre clique sur **Paramètres › Google Agenda › Connecter Gmail** (second consentement, lecture seule : ni envoi, ni suppression).
   - Lecture : 30 derniers jours à la connexion, puis les nouveaux messages, par lots de 12 à chaque passage du cron (« Actualiser » sur la page E-mails pour avancer tout de suite). Lettres d'information, notifications et catégories Promotions / Réseaux sociaux / Forums / Mises à jour sont ignorées.
   - Rattachement : contact connu, puis domaine d'un client (jamais gmail.com et autres messageries), puis fil de discussion, puis clé ou nom du projet dans l'objet. Seuls les e-mails rattachés à un client sont gardés ; leur texte est effacé après 30 jours. Pour les inconnus, seuls des compteurs : ceux avec qui l'agence a vraiment échangé sont proposés comme nouveaux contacts.
   - Avec `MISTRAL_API_KEY`, chaque e-mail reçu d'un client **après la connexion** est lu par Mistral (`MISTRAL_EMAIL_MODEL`, `mistral-small-latest` par défaut) : actions proposées avec citation vérifiée, et réunion proposée si l'e-mail contient un lien Meet, Teams ou Zoom et une heure claire (à confirmer dans Réunions avant tout enregistrement).
5. Après `npm run db:push`, activer la RLS sur les nouvelles tables (section « Sécurité de la base »).

Fonctionnement : rien n'est enregistré sans qu'un membre clique sur « Enregistrer » (le membre dont l'agenda porte la réunion, ou un administrateur) ; le robot part 2 minutes avant le début, se présente sous son nom dans la liste des participants, et sort à la fin. Le compte rendu propose des actions avec leur citation ; aucune tâche n'est créée sans validation. Audio supprimé après 30 jours, transcription après un an (étape quotidienne `meeting-retention`).

## Configuration, erreurs, sauvegardes

**Variables d'environnement.** `src/lib/env.ts` les valide au démarrage (`src/instrumentation.ts`) : une variable obligatoire absente ou une intégration à moitié configurée fait échouer le démarrage avec la liste des problèmes. Une intégration dont aucune variable n'est renseignée est simplement désactivée. Liste complète dans `.env.example`.

**Erreurs.** Avec `SENTRY_DSN`, les erreurs serveur partent dans Sentry (étiquettes `via` et `projectKey`, sans cookie ni corps de requête). `HEARTBEAT_URL` (healthchecks.io, Sentry Crons…) reçoit un ping à chaque passage du cron, et `<url>/fail` en cas d'échec.

**Sauvegardes (décision D10 : Supabase Pro).**

1. Passer le projet Supabase en **Pro** : sauvegardes quotidiennes, et plus de mise en pause après inactivité.
2. Sauvegarde externe chiffrée : `.github/workflows/backup.yml` lance chaque nuit `pg_dump -Fc`, chiffre avec [age](https://age-encryption.org) et envoie le fichier dans un bucket S3 compatible **situé dans l'UE** (Scaleway, OVH, AWS eu-west-3…). Secrets GitHub à créer : `BACKUP_DATABASE_URL` (connexion directe, port 5432, rôle en lecture seule de préférence), `BACKUP_AGE_RECIPIENT` (clé publique `age1…` ; la clé privée reste hors ligne, chez deux personnes), `BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT` (sauf AWS), `BACKUP_S3_REGION`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`. Configurer une règle d'expiration sur le bucket (ex. 35 jours).
3. **Exercice de restauration chaque trimestre** : `age -d -i cle.txt fichier.dump.age > base.dump`, puis `pg_restore --no-owner --dbname "$URL_DE_TEST" base.dump` dans un projet Supabase de test, et vérifier que l'outil démarre dessus.

**Journal des connexions** : Paramètres › Journal (administrateurs).

## Structure

```
prisma/schema.prisma     modèle de données (projets, tâches, mises en ligne, activité)
prisma/seed.ts           équipe et projets de départ
src/proxy.ts             redirection vers /login sans session (vérification optimiste)
src/lib/dal.ts           couche d'accès aux données : chaque lecture vérifie la session
src/app/actions/         Server Actions minces : session → validation → service → revalidation
src/lib/services/        logique métier (Actor { userId, via }), partagée par les actions, l'API, MCP et les webhooks
src/lib/jobs/            file de travaux (Job), cron, distribution de l'outbox (Event)
src/lib/quick-add.ts     analyse de la saisie rapide
src/lib/feedback-import.ts  import des tableaux de retours client
src/app/(app)/           Aujourd'hui, Projets, Projet (tableau, liste, mises en ligne, activité), Clients, Paramètres (code PIN, équipe)
```
