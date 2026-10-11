# Suzali Tasks: app overview

Internal project and task tool for the agency Suzali Conseil (planned for tasks.suzaliconseil.com). All UI copy is in French. It is separate from the Captain Prospect CRM: own database, own accounts.

## What it does

- **Paste client feedback in:** copy a feedback table (Date · Page · Retour · Commentaire · État) from Google Sheets. Each row becomes a task with its page and status. Feedback batches are tracked as rounds ("Retours").
- **"En attente client" is a real status:** you see at a glance what is blocked on the client, and for how many days (the waiting-age chip is the product's signature).
- **Relancer:** chase the client, with the last chase date kept per project.
- **Dated deliveries ("Mises en ligne"):** each one is recorded to the minute, with the tasks it contains. It is the proof of what shipped and when.
- **Client recap:** a ready-to-send message (done / waiting on you / in progress), generated from a date or from the last delivery.
- **Hors périmètre (€) and avenants:** out-of-scope changes are flagged, quoted and counted per project. A billing page ("Facturation") summarises them.
- **Point d'étape:** a two-sentence status note per project (where we are, next action).
- **Aujourd'hui, for the whole team:** my tasks, tasks to assign, each member's load, projects to chase (client blocking for 5+ days), recent deliveries.
- **Quick add everywhere:** `Retirer l'ombre @odo !haute #homepage demain $`. The `Ctrl K` palette goes anywhere or creates a task. `C` opens a new task.
- **Team managed in the app:** an administrator adds a member or resets a PIN from Paramètres › Équipe. Sign-in is by e-mail and a 6-digit PIN.

## Pages

| Route | Page |
|---|---|
| `/login` | PIN sign-in |
| `/` | Aujourd'hui |
| `/projects` | Projects, grouped by state (en cours, en attente client, en pause, livrés) |
| `/projects/[slug]` | Project: Tableau (board), Liste, Retours, Avenants, Mises en ligne, Activité |
| `/t/[ref]` and `?tache=BG-12` | A task (full page, or the side drawer) |
| `/clients` | Clients and their contacts |
| `/facturation` | Billing of out-of-scope work |
| `/settings` | Theme, own PIN, team, integrations, journal, templates |

## Stack

Next.js 16 (App Router, Server Actions, with breaking changes: read `node_modules/next/dist/docs/` first) · React 19 · Prisma 6 · PostgreSQL (Supabase) · signed sessions (jose) · Tailwind CSS 4 · dnd-kit · cmdk · sonner · date-fns · zod · Sentry · vitest + Testing Library + vitest-axe.

## Where things live

```
src/app/(app)/        pages (Aujourd'hui, projects, clients, facturation, settings, t/[ref])
src/app/actions/      Server Actions (tasks, projects, deliveries, rounds, extras, team…)
src/components/       views, dialogs, board, drawer, sidebar, palette
src/components/ui/    primitives (button, input, tabs, badge, floating…)
src/lib/              dal, services, time (Paris), chasing, import, jobs, colour helpers
src/app/globals.css   design tokens (the only place with raw colour values)
prisma/schema.prisma  data model; prisma/seed.ts creates the team and projects
docs/PLAN.md          master enhancement plan and the French glossary
design-plans/         UI plans (project page, whole app)
scripts/contrast.mjs  contrast checks for the tokens
```

## Run it

```bash
npm install
cp .env.example .env     # DATABASE_URL, DIRECT_URL, SESSION_SECRET, SEED_PASSWORD
npm run db:push
npm run db:seed
npm run dev
```

Checks: `npm run check` (typecheck, lint, tests) and `node scripts/contrast.mjs`.

## Conventions worth knowing

- Copy follows the glossary in `docs/PLAN.md` §0.4 ("Chez le client", "attribuer", "Mise en ligne", "Relancer"…) and French typography.
- Servers run in UTC; "today" and delivery times follow Paris time.
- Colours come from tokens (ink and cobalt on cool neutrals, status tones with meaning); light, dark and system themes.
- The repo mixes CRLF and LF line endings: keep each file's endings when editing.
