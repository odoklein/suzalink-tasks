# Suzali Tasks

Gestion de projets et de tâches de l'agence Suzali Conseil, prévue sur **tasks.suzaliconseil.com**.

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
```

## Mise en ligne sur tasks.suzaliconseil.com

1. **Base** : créer un projet Supabase, récupérer les deux chaînes de connexion, lancer `npm run db:push` puis `npm run db:seed` en local avec ces valeurs.
2. **Hébergement** (Netlify, comme les autres sites, ou Vercel) : importer le dépôt, commande de build `npm run build`, et renseigner `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` dans les variables d'environnement.
3. **Domaine** : ajouter `tasks.suzaliconseil.com` comme domaine personnalisé, puis créer chez le registrar de suzaliconseil.com un enregistrement **CNAME** `tasks` → l'adresse fournie par l'hébergeur (ex. `suzali-tasks.netlify.app`). Le HTTPS est activé automatiquement.

## Structure

```
prisma/schema.prisma     modèle de données (projets, tâches, mises en ligne, activité)
prisma/seed.ts           équipe et projets de départ
src/proxy.ts             redirection vers /login sans session (vérification optimiste)
src/lib/dal.ts           couche d'accès aux données : chaque lecture vérifie la session
src/app/actions/         Server Actions (chaque écriture vérifie aussi la session)
src/lib/quick-add.ts     analyse de la saisie rapide
src/lib/feedback-import.ts  import des tableaux de retours client
src/app/(app)/           Aujourd'hui, Projets, Projet (tableau, liste, mises en ligne, activité), Clients, Paramètres (code PIN, équipe)
```
