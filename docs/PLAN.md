# Suzali Tasks: master enhancement plan

> **Who this is for.** An implementing agent (Claude Sonnet 5.5) working in this repo, one task at a time.
> **Where it comes from.** Five specialist audits (UI design, product design, UX, integrations/automation, accessibility/mobile/performance) run on 2026-10-08 against commit `1a6d1a8`. The audits were merged, deduplicated and reordered here into one sequence. Bugs marked **[verified]** were checked against the code by hand.

---

## 0. How to work through this plan

### 0.1 Ground rules (read every time)

1. **This is Next.js 16.3 and it has breaking changes.** Before touching any Next API (route handlers, `loading.tsx`, `error.tsx`, `proxy.ts`, caching, `after()`, `refresh`, `updateTag`, intercepting routes, metadata files, view transitions), read the matching guide in `node_modules/next/dist/docs/`. Don't rely on training-data knowledge of Next 13–15. `src/proxy.ts` replaces `middleware.ts`.
2. **One task = one commit.** Use the task ID in the subject, for example `P1-03 Quick-add : même ordre d'équipe client/serveur`. Follow the repo's style: short French subjects. End the message with:
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
3. **After every task**, run `npm run typecheck` and `npm run lint`, plus `npm test` once Phase 0 exists. All must pass before you commit.
4. **All UI copy is French.** Follow the glossary in §0.4, and French typography: a narrow no-break space before `: ; ! ? %` and inside « », and the `’` apostrophe in visible strings.
5. **Database.** The project uses `prisma db push` against Supabase (production data exists).
   - Only make **additive** schema changes: new nullable or defaulted columns, new tables, new indexes.
   - Never rename or drop a column in the same task that stops using it. Do that in a later, explicit cleanup task.
   - Add data backfills as idempotent scripts in `prisma/scripts/*.ts`, run with `npx tsx`.
   - **Never run `db push` or a backfill against production yourself.** List the command in the commit/PR description for a human to run.
6. **Don't** expand scope, refactor unrelated code, rename files, or change the PIN-auth model unless a task says to.
7. **Security invariants.** Every Server Action and every DAL read calls `verifySession()` first. Never export a helper from a `"use server"` file unless it is meant to be a public, authenticated action; shared logic goes in `src/lib/**` with `import "server-only"`.
8. Tasks marked **DECISION** carry a default. Use the default unless the human has said otherwise, and note it in the commit body.
9. Every task lists **Acceptance** criteria. Don't mark a task done until each one holds. Where a criterion needs a browser, write a Playwright test once Phase 0 exists; otherwise describe the manual check in the commit body.
10. Windows dev machine: use forward slashes in scripts and make no POSIX-only assumptions in npm scripts (use `cross-env` if env vars are needed).

### 0.2 Codebase map (as of `1a6d1a8`)

```
prisma/schema.prisma        User, Client, Project, Task, Comment, Delivery, Activity (+ enums)
prisma/seed.ts              TEAM (7 users), CLIENTS, projects
src/proxy.ts                cookie-presence redirect to /login (no secret here: Netlify secret scanning)
src/lib/dal.ts              verifySession (cache), getCurrentUser, getTeam (orderBy name), project/nav loaders
src/lib/session.ts          jose JWT, 30 days
src/lib/session-cookie.ts   cookie name
src/lib/db.ts               Prisma singleton
src/lib/quick-add.ts        parseQuickAdd(input, team, now): @member !prio #zone dates $
src/lib/feedback-import.ts  parseTsv, parseFeedbackTable, statusFromLabel
src/lib/constants.ts        TASK_STATUSES, PRIORITIES, PROJECT_STATUSES, PROJECT_COLORS, MEMBER_COLORS
src/lib/utils.ts            cn (clsx, NO tailwind-merge), slugify, projectKey, dates
src/lib/types.ts            client-side task shapes
src/app/actions/*.ts        auth, tasks, projects, deliveries (incl. buildRecap), team
src/app/(app)/page.tsx      "Aujourd'hui" (server component, ~11 queries)
src/app/(app)/projects/...  list + [slug] project page
src/app/(app)/clients, settings
src/app/login/*             PIN login
src/components/             app-context (openTaskId in React state), board (dnd-kit), task-card, task-row,
                            task-list, task-drawer, select-menu, dialog, command-palette (cmdk), quick-add,
                            new-task-dialog, project-view, project-dialogs (Import/Recap/Delivery/NewProject),
                            project-note, sidebar, primitives (Avatar, StatusIcon, DueChip, ProjectTile…), pin-input
src/app/globals.css         tokens (:root + prefers-color-scheme dark) mapped via @theme inline
```

Mutations currently call `revalidatePath("/", "layout")` through a local `refresh()` helper in each action file.

### 0.3 Phase overview

| Phase | Theme | Rough size | Depends on |
|---|---|---|---|
| **0** | Safety net: tests, CI, helpers | 1–2 days | none |
| **1** | Critical bugs and data integrity | 3–4 days | 0 |
| **2** | Design system: tokens, contrast, primitives | 4–6 days | 1 |
| **3** | Core UX: task URLs, search, undo, Today, bulk, filters, keyboard | 2 weeks | 1, 2 (partly) |
| **4** | Domain model: history, import dedupe, chasing, rounds, deliveries | 2 weeks | 1 |
| **5** | Accessibility AA, mobile, performance | 1–2 weeks | 2 |
| **6** | Platform foundation for integrations | 1 week | 1 |
| **7** | Integrations and AI | 3–5 weeks | 6, 4 |
| **8** | Client-facing and revenue | 4+ weeks | 6, 7 |
| **9** | Productisation (only if decided) | n/a | everything |

Phases 2/3/4/5 can be interleaved, but **inside a phase, do tasks in the order listed.**

### 0.4 French glossary (single source of truth for copy)

| Concept | Use | Don't use |
|---|---|---|
| Task waiting on the client | **Chez le client** (status menu label: « En attente client ») | Attente client, Bloqué côté client (except as a section title on Aujourd’hui) |
| Assign | **attribuer / attribuée à / non attribuée / a réattribué** | assigner, assignée |
| REVIEW status | **À valider** (= internal check before telling the client). **DECISION:** keep « À valider »; add the tooltip « Vérification interne avant d’annoncer au client » | |
| Delivery | **Mise en ligne** | Déploiement, Livraison (except project status « Livré ») |
| Out of scope | **Hors périmètre (€)** | Facturable |
| Chase the client | **Relancer / relance** | Rappeler |
| Status note | **Point d’étape** | |
| Feedback batch | **Retours** / « lot de retours » | Feedback |
| Keyboard verb | **Appuyez sur C** | Tapez C |

Add `src/lib/plural.ts` with `plural(n, "tâche")` returning `1 tâche` / `3 tâches` (handle irregulars through a second argument) and use it everywhere a count is shown.

---

## Phase 0: Safety net

### P0-01 Test tooling
- **Do:**
  - Add dev dependencies `vitest @vitest/coverage-v8 happy-dom @testing-library/react @testing-library/user-event vitest-axe`.
  - Add `vitest.config.ts` with the `@/` alias, `environment: "node"` by default and `happy-dom` for `*.dom.test.tsx`.
  - Add scripts `"test": "vitest run"`, `"test:watch": "vitest"`, `"check": "npm run typecheck && npm run lint && npm test"`.
- **Acceptance:** `npm test` runs (no tests yet is fine, or use a placeholder test).

### P0-02 Extract pure helpers so they can be tested
- **Do:**
  - Move the board position maths from `src/components/board.tsx` (the drag-end index → position computation) into `src/lib/position.ts`: `computePosition(prev?: number, next?: number): number`.
  - Move the weak-PIN check, which is duplicated in `src/app/actions/auth.ts` and `src/app/actions/team.ts`, into `src/lib/pin.ts`: `isWeakPin(pin)`.
  - Keep behaviour identical.
- **Acceptance:** typecheck passes; board and PIN behaviour unchanged.

### P0-03 First unit tests
- **Files:** `src/lib/quick-add.test.ts`, `feedback-import.test.ts`, `utils.test.ts`, `position.test.ts`, `pin.test.ts`.
- **Cases (minimum):**
  - **quick-add:**
    - `"Retirer l'ombre @odo !haute #homepage demain $"` with `now=2026-10-08T10:00` gives title `Retirer l'ombre`, Odo, HIGH, zone `Homepage`, due 2026-10-09, billable.
    - `"!!!"` gives URGENT.
    - `"+3j"`.
    - `"12/01"` typed on 2026-12-20 gives 2027-01-12.
    - `"31/02"` stays in the title.
    - `"@inconnu"` stays in the title.
    - **Ambiguity test** with team `[Antoine, Anaïs, Amine]` in that order: `@an` must resolve to the alphabetically first match. It fails today; P1-03 fixes it.
  - **feedback-import:**
    - The standard header row `Date\tPage\tRetour\tCommentaire\tÉtat`.
    - A quoted multiline cell with `""`.
    - "Pas fait" plus a comment containing "en attente" gives WAITING_CLIENT.
    - CRLF line endings.
    - Blank rows dropped.
    - A long title truncated, with the rest moved to the description.
  - **utils:** `projectKey`, `slugify("Éé Ça!") === "ee-ca"`.
  - **position:** empty list, top, bottom, midpoint, and 60 successive midpoint inserts still strictly increasing.
  - **pin:** `111111`, `123456`, `987654` are weak; `275039` is fine.
- Mark known-failing tests `it.fails(...)` with the task ID that fixes them.

### P0-04 CI
- **File:** `.github/workflows/ci.yml`.
- **Job `checks`** (ubuntu, Node 20): `npm ci`, `npx prisma validate`, typecheck, lint, `npm test -- --coverage`.
- **Job `e2e`:** add it in P5-15, not now.
- **Acceptance:** the workflow file is valid YAML; it uses no secrets (dummy env values for `DATABASE_URL` only where `prisma generate` needs them).

### P0-05 Paris time helper
- **Do:**
  - Add `@date-fns/tz`.
  - Create `src/lib/time.ts` with:
    - `export const TZ = "Europe/Paris"`
    - `nowParis()`
    - `startOfDayParis(d)`
    - `endOfDayParis(d)`
    - `toParisDateInput(d)` (`yyyy-MM-dd`)
    - `toParisDateTimeInput(d)` (`yyyy-MM-ddTHH:mm`)
    - `fromParisDateTimeInput(s)` (gives a UTC Date)
    - `formatParis(d, pattern)`
- **Tests:** at `2026-10-08T23:30Z`, `startOfDayParis` gives `2026-10-09T00:00+02:00`. A DST boundary case (2026-10-25).
- Consumers are migrated in P1-05 and P1-06.

---

## Phase 1: Critical bugs and data integrity

### P1-01 Error boundaries and 404s [verified: none exist]
- **Read first:** `node_modules/next/dist/docs/**/error.md`, `not-found.md`. In 16.3 the error component receives `retry` (check the doc for the exact prop).
- **Create:**
  - `src/app/global-error.tsx`: its own `<html lang="fr"><body>`, French message, « Réessayer ».
  - `src/app/not-found.tsx`.
  - `src/app/(app)/error.tsx` (`"use client"`): message « Une erreur est survenue », a « Réessayer » button, and a link to Aujourd’hui.
  - `src/app/(app)/projects/[slug]/not-found.tsx`: « Ce projet n’existe pas (ou plus) », with links to Projets and a Ctrl K hint.
- Style everything with existing tokens.
- **Acceptance:** visiting `/projects/doesnotexist` shows the French 404 inside the app shell, and a thrown error in a page shows the French boundary.

### P1-02 Server Actions return errors instead of throwing
- **Do:**
  - Create `src/lib/action.ts`:
    ```ts
    import { isRedirectError } from "next/dist/client/components/redirect-error"; // verify path in node_modules; else check digest startsWith("NEXT_REDIRECT") / "NEXT_HTTP_ERROR_FALLBACK"
    export type ActionResult<T = void> = ({ ok: true } & (T extends void ? {} : { data: T })) | { ok?: false; error: string };
    export async function safe<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
      try { return await fn(); }
      catch (e) { if (isNextControlFlow(e)) throw e; console.error(e); return { error: "Une erreur est survenue. Réessayez." }; }
    }
    ```
    Find the correct way to detect Next's redirect/notFound control-flow errors in Next 16 (search `node_modules/next/dist` for `isRedirectError` / `isNotFoundError` / `unstable_rethrow`). **Prefer `unstable_rethrow` from `next/navigation` if it exists in this version.**
  - Wrap the body of every exported action in `src/app/actions/*.ts`.
  - Every client caller checks `"error" in res` and shows `toast.error(res.error)`.
- **Callers to audit:** `board.tsx`, `task-row.tsx`, `task-drawer.tsx`, `project-view.tsx`, `project-note.tsx`, `project-dialogs.tsx`, `quick-add.tsx`, `new-task-dialog.tsx`, `team-section.tsx`, `password-form.tsx`, `command-palette.tsx`.
- **Acceptance:** with the DB down, actions give a toast instead of a white screen.

### P1-03 Quick-add assigns the wrong person [verified]
- **Cause:**
  - `quickAddTask` (`src/app/actions/tasks.ts` ~l.79) loads the team **unordered**.
  - The client preview uses `getTeam()`, which is ordered by name (`src/lib/dal.ts`).
  - `parseQuickAdd` picks the first prefix match (`src/lib/quick-add.ts` ~l.96).
  - So the preview and the saved assignee can differ.
- **Fix, in this order:**
  - (a) Server: add `orderBy: { name: "asc" }`.
  - (b) In `parseQuickAdd`, prefer an exact first-name match, then a unique prefix match. When the prefix is ambiguous, return a token `{ kind: "ambiguous", candidates }`, leave the word in the title, and set no assignee.
  - (c) The client sends the `assigneeId` it resolved for the preview. The server accepts it if it is a valid user id; otherwise it re-parses.
  - (d) The UI shows ambiguous tokens as an amber chip: « @an : Anaïs ou Antoine ? ».
- **Acceptance:** the P0-03 ambiguity test passes (remove `it.fails`); the preview always equals the result.

### P1-04 Drawer edits lost on close
- **Cause:** the title and description in `src/components/task-drawer.tsx` save on `blur`, but Escape and backdrop clicks unmount the drawer first.
- **Fix:**
  - Hold drafts in refs.
  - Add `flushDrafts()`, which compares each draft to the server value and calls `patch` for changed fields. Call it before `closeTask()` on Escape, backdrop click, the X button, and when switching task.
  - Keep any unsent comment per task in `sessionStorage` (key `draft-comment:<taskId>`, cleared on send).
- **Acceptance:** type in the title, press Esc, reopen: the change is saved. Type a comment, close, reopen: the draft is restored.

### P1-05 Delivery time stored 1–2 h late [verified]
- **Cause:**
  - `src/app/actions/deliveries.ts` ~l.26 does `new Date(input.deployedAt)` on a UTC server, with a `datetime-local` string that has no zone.
  - Times are also formatted in client components during SSR, so the server renders 13h05 and the client renders 15h05 (hydration mismatch).
- **Fix:**
  - The client converts with `new Date(value).toISOString()` before calling the action (the browser is in Paris). Or the server uses `fromParisDateTimeInput`; pick one and document it in the code.
  - Default values in `DeliveryDialog` use `toParisDateTimeInput(new Date())`.
  - Render delivery and activity timestamps on the server, or through a `<LocalTime iso=…/>` client component that formats after mount (`suppressHydrationWarning` on the `<time>` is acceptable).
- **Backfill (human runs it):** `prisma/scripts/fix-delivery-tz.ts`. It lists deliveries where `deployedAt` was user-entered (author not null, created after `deployedAt`'s day) and prints the proposed correction. **Dry-run by default**; apply only with `--apply`.
- **Acceptance:** creating a delivery at 14:30 shows « 14h30 », with no hydration warning in the console.

### P1-06 "Today" boundaries and quick-add dates in Paris time
- **Fix:**
  - In `src/app/(app)/page.tsx`, compute `today`, `tomorrow`, the week strip and overdue from `startOfDayParis(nowParis())`.
  - Make `parseQuickAdd` accept a `now` that is already Paris-based, and have date tokens resolve to Paris midnight. The server call in `quickAddTask` passes `nowParis()`.
- **Acceptance:** a unit test at 00:30 Paris (22:30 UTC) treats « demain » as the next Paris day.

### P1-07 Status menu clipped in rows [verified]
- **Cause:** `overflow-hidden` on the `<li>` in `src/components/task-row.tsx` ~l.50, and on the parent containers in `task-list.tsx` (~l.82) and `(app)/page.tsx` (~l.380). `select-menu.tsx` positions its popup absolutely.
- **Fix:**
  - Render the `SelectMenu` popup in a portal (`createPortal(…, document.body)`), `position: fixed`, placed from the trigger's `getBoundingClientRect()`.
  - Flip it above the trigger when there isn't room below.
  - Reposition on scroll and resize; close on outside `pointerdown` and on `focusout` outside.
  - Use `z-index` from the scale in P2-01 (popover layer).
- Remove the `overflow-hidden` that is now pointless; use `truncate` on the title instead.
- **Acceptance:** the status menu opens fully from the last row of a list, inside the drawer, and inside dialogs.

### P1-08 Board optimistic rollback
- **Cause:** `src/components/board.tsx` ~l.97-128: on error it toasts but leaves the columns in the wrong state.
- **Fix:** snapshot the columns before the move and restore them on error. Ignore server resyncs (`tasks` prop changes) while a drag is active (`activeId != null`); queue the resync until drag end.
- Apply the same treatment to `project-note.tsx` (don't mark saved before success), `project-view.tsx` (project status: check the result before the success toast) and `task-drawer.tsx` (delete: success toast only on `ok`).
- **Acceptance:** with a simulated failure (temporarily throw in `moveTask`), the card snaps back.

### P1-09 Drawer stuck on the skeleton when the task is gone
- **Fix:** the drawer state becomes `status: "loading" | "ready" | "missing" | "error"`. When `getTaskDetail` returns null, show « Cette tâche a été supprimée. » and a Fermer button. Errors get a « Réessayer » button. Ignore stale responses with a request counter, so a slow early load can't overwrite later data.
- **Acceptance:** delete a task in another tab and open it here: you see the message, not an endless skeleton.

### P1-10 Import feedback in one transaction
- **Cause:** `importFeedback` in `src/app/actions/tasks.ts` (~l.235-257) calls `insertTask` once per row, about 3 round-trips each.
- **Fix:** one `db.$transaction(async tx => …)`:
  1. `project.update({ taskCounter: { increment: N } })` to get `start = counter - N + 1`.
  2. One read of the max position per status.
  3. `tx.task.createMany` with numbers `start..start+N-1` and positions `base + 1000*i` per status.
  4. One activity row: « a importé 18 retours ».
- Move `nextPosition` inside the transaction for `insertTask` too.
- **Acceptance:** importing 60 rows takes under 2 s locally, numbers are contiguous, and there are no duplicate positions.

### P1-11 Login attempt counter race and lockout leak [verified race]
- **Cause:** `src/app/actions/auth.ts` ~l.32-45 reads `failedLogins`, then writes `failed + 1`. Parallel requests bypass the limit.
- **Fix:**
  - Reserve an attempt atomically **before** the bcrypt compare:
    ```ts
    const rows = await db.$queryRaw<{ failedLogins: number }[]>`
      UPDATE "User" SET "failedLogins" = "failedLogins" + 1
      WHERE id = ${user.id} AND ("lockedUntil" IS NULL OR "lockedUntil" < now())
      RETURNING "failedLogins"`;
    if (rows.length === 0) return lockedError;          // currently locked
    if (rows[0].failedLogins > MAX_ATTEMPTS) { /* set lockedUntil, failedLogins=0 */ return lockedError; }
    const valid = await bcrypt.compare(pin, user.passwordHash);
    if (valid) await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    ```
  - Escalate the lock: 15 min, then 1 h, then 24 h. Add `User.lockLevel Int @default(0)` and reset it on success.
  - From the 3rd failure, the error reads « Code incorrect. Encore 2 essais avant blocage. »
  - Return `lockedUntil` so the UI can show a live countdown and disable the submit button.
- **Acceptance:** a unit/integration test runs 10 parallel wrong attempts and ends with ≤ 5 counted and a lock.

### P1-12 Session revocation
- **Do:**
  - Add `User.sessionVersion Int @default(0)` and `User.active Boolean @default(true)`.
  - Put `v` in the JWT payload (`src/lib/session.ts`).
  - In `verifySession()` (cached per request), load `{ sessionVersion, active }` and reject on a mismatch or `!active` by deleting the cookie and redirecting to `/login`.
  - Increment `sessionVersion` on PIN change, admin PIN reset, and deactivation.
  - Add « Se déconnecter de tous les appareils » in Paramètres.
- **Acceptance:** after an admin PIN reset, the user's other browser is logged out on the next request.

### P1-13 Deep-link return after login
- **Do:**
  - `src/proxy.ts` redirects to `/login?next=<pathname+search>`.
  - The login action takes `next`, validates it (starts with `/`, not `//`, no `\`), and redirects there; otherwise `/`.
  - Store the remembered email in localStorage only **after** a successful login.
- **Acceptance:** opening `/projects/x?vue=liste` while logged out lands there after login.

### P1-14 PIN reset confirmation and forced change
- **Do:**
  - `team-section.tsx`: « Nouveau code » shows an inline confirm: « Le code actuel de {prénom} ne fonctionnera plus. Générer un nouveau code ? ».
  - Add `User.mustChangePin Boolean @default(false)`, set when an admin creates a user or resets a PIN. `(app)/layout.tsx` redirects to `/settings?premiere-connexion=1` until it is changed.
  - Add « Copier l’invitation »: « Connectez-vous sur https://tasks.suzaliconseil.com avec {email} et le code {pin}. Vous choisirez votre propre code à la première connexion. »
  - On the PIN change form, completing one PinInput focuses the next.
- **Acceptance:** an admin reset needs two clicks, and the reset user must pick a new PIN before reaching Aujourd’hui.

### P1-15 Command palette: no accidental task creation
- **Cause:** `src/components/command-palette.tsx` renders « Créer une tâche » before « Aller à », its `value` contains the query (so it always matches), and it only offers the first 6 projects alphabetically.
- **Fix:**
  - Creation is an explicit mode: a query starting with `+`, or a « Créer une tâche… » item that switches mode.
  - Targets: the current project first, then the last used project (localStorage `last-project`), then active projects only.
  - « Aller à » groups rank first.
- **Acceptance:** typing « Bièr » then Enter navigates to Bières Georges.

### P1-16 Wrong default project and silent quick-add
- **Do:**
  - `new-task-dialog.tsx`: the default is the current project slug, else `last-project` from localStorage, else the first **active** project.
  - Pressing C with zero projects shows the toast « Créez d’abord un projet » with an action button.
  - `quick-add.tsx`: keep the input **enabled** while saving (clear immediately, restore the text on error).
  - On success, toast « BG-15 créée · Ouvrir ».
  - An empty title shows the inline error « Ajoutez un titre ».
- **Acceptance:** you can type 3 tasks back to back without waiting.

### P1-17 Copy and grammar fixes
- **Fix:**
  - « Créer 1 tâches » / « Créer  tâches » (`project-dialogs.tsx` ~l.82).
  - « 1 retours importés ».
  - « + 1 autres ».
  - The `capitalize` class on the French date in `(app)/page.tsx` (~l.132): uppercase only the first character.
  - « Tapez C » → « Appuyez sur C ».
  - « Belle journée, » → « Bonne journée, ».
  - Apply the §0.4 glossary across `constants.ts`, `primitives.tsx`, `task-drawer.tsx`, `new-task-dialog.tsx`, `tasks.ts` log messages and `(app)/page.tsx`.
  - Add `src/lib/fr.ts` with `nbsp` helpers. Format percentages with `Intl.NumberFormat("fr-FR", { style: "percent" })`.
  - Replace the hard-coded « Demandez à Odo ou Hichem » in `src/app/login/page.tsx` with admin first names loaded from the DB (a public read of names only, with role ADMIN and active).
- **Acceptance:** grep finds no « assign » in user-visible strings and no `capitalize` on dates.

### P1-18 Small correctness items
- `createProject`: create the client and the project inside one `$transaction`.
- `generateMetadata` in `projects/[slug]/page.tsx`: call `verifySession()` first, and share one `cache()`-wrapped loader with the page so the query runs once.
- Validate URLs on the server (`siteUrl`, delivery `url`): `new URL(v)` with protocol http or https. Use `type="url"` inputs.
- Project key: `pattern="[A-Za-z0-9]{1,4}"`, uppercased on the server.
- Title max length 180, description 5000, enforced on the server.
- The drawer date input fires `patch` on every keystroke: commit on blur or Enter only, and ignore years before 2000.
- `Activity.task` relation: `onDelete: SetNull` (keep the history when a task is deleted).

---

## Phase 2: Design system, contrast, primitives

> Goal: one coherent token layer that passes WCAG AA, a set of shared primitives, and no ad-hoc sizes. **Change tokens first, then migrate the call sites.**

### P2-01 Token layer rewrite (`src/app/globals.css`)
- **Replace** the `:root` and dark blocks with a full token set. Target values (light mode; check each pair with a contrast script, `scripts/contrast.mjs`, added in this task):
  - **Neutrals:**
    - `--bg #f4f5f2` (canvas)
    - `--chrome #eeefeb` (sidebar: **darker** than the canvas so it recedes)
    - `--surface #fff`
    - `--surface-2 #f9f9f7`
    - `--sunken #ebebe8`
    - `--line #e3e3df`
    - `--line-strong #d1d1cc`
    - `--ink #16181d`
    - `--ink-2 #3b4048`
    - `--muted #646973` (≥ 4.5:1 on `--sunken`)
    - `--faint #8f9298`: **icons, placeholders and disabled only, never information text**
  - **Accent:** `--accent #295ee3`, `--accent-soft #e4efff`, `--accent-ink #fff`.
  - **Tone triplets** (solid / text / soft), for `todo`, `progress`, `waiting`, `review`, `done`, `danger` and a new **`soon`** (orange, for due today or tomorrow, so it no longer shares amber with waiting):
    - `--waiting #da950b` / `--waiting-text #8a5a00` / `--waiting-soft #fdf1d8`
    - `--done #169f65` / `--done-text #137a4c` / `--done-soft #e1f8eb`
    - `--review #7855df` / `--review-text #6744c5`
    - `--danger #c93029` / `--danger-text #b8321f` / `--danger-soft`
    - `--soon #e0700f` / `--soon-text #af4803` / `--soon-soft`
    - `--todo-text` = `--muted`
  - **Elevation:** `--shadow-xs`, `--shadow-card`, `--shadow-raised`, `--shadow-pop`, `--shadow-overlay`; `--ring: 0 0 0 1px var(--accent), 0 0 0 4px var(--accent-soft)`; `--scrim rgb(10 12 16 / .36)` (one value for the drawer, dialogs, palette and mobile nav).
  - **Motion:** `--ease-out cubic-bezier(.2,.8,.2,1)`, `--ease-in cubic-bezier(.4,0,1,1)`, `--dur-1 120ms`, `--dur-2 180ms`, `--dur-3 240ms`.
  - **Layout:** `--sidebar-w 248px`, `--drawer-w 560px`, `--page-wide 1200px`, `--page-medium 960px`, `--page-narrow 720px`.
  - **Dark mode:**
    - Redefine every token.
    - `--chrome` is darker than `--surface`.
    - The soft tones use `color-mix(in oklch, var(--tone) 16%, var(--surface))`.
    - `--scrim rgb(0 0 0 / .55)`.
    - The card shadow gets a 4% white hairline.
    - The primary button uses the accent in dark mode, not a near-white slab.
  - **Manual theme:** support `:root[data-theme="dark"]` and `[data-theme="light"]` alongside `prefers-color-scheme`. The switch itself ships in P2-13.
- **Also in `@theme`:**
  - **Radii:** `--radius-xs 4px`, `-sm 6px`, `-md 8px`, `-lg 12px`, `-xl 16px`.
  - **Type scale** (name → size / line-height):

    | Token | Size / line-height | Use |
    |---|---|---|
    | `meta` | 11 / 14 | IDs, kbd, counts |
    | `xs` | 12 / 16 | |
    | `ui` | 13 / 18 | default UI text |
    | `body` | 14 / 21 | |
    | `title` | 17 / 24 | |
    | `h2` | 22 / 28 | |
    | `h1` | 28 / 34 | |
    | `hero` | 34 / 40 | |

  - **z-index:** `--z-sidebar 40`, `--z-drawer 50`, `--z-dialog 60`, `--z-palette 70`, `--z-popover 75`, `--z-toast 80`.
- Keep the old token names as aliases (`--st-waiting: var(--waiting)` …) for this task, so nothing breaks. They are removed in P2-04.
- **Acceptance:** the contrast script reports every *text* token pair ≥ 4.5:1 on `--surface`, `--bg` and `--sunken`, in both themes. Commit the script output as a comment in the CSS.

### P2-02 `cn()` with tailwind-merge
- Add `tailwind-merge`. Change `src/lib/utils.ts` to `export const cn = (...i: ClassValue[]) => twMerge(clsx(i))`.
- **Acceptance:** `cn("px-3.5 py-2 text-[13px]", "px-3 text-[12px]")` resolves the conflicts; add a unit test.

### P2-03 Fonts
- `src/app/layout.tsx`:
  - Bricolage Grotesque loaded with `axes: ["opsz", "wdth"]`, used **only at 22px and above** (page h1, Aujourd’hui hero, stat values, empty-state titles, login).
  - Card, dialog and panel titles move to Instrument Sans 17px semibold, `tracking-[-0.01em]`.
  - JetBrains Mono gets `preload: false` and is used only for task IDs, PINs and keys, **never for dates**.

### P2-04 Codemod: sizes, radii, colours
- **Mechanical replacements** across `src/`:
  - `text-[11px]` → `text-meta`, `[12px]` → `text-xs`, `[13px]` → `text-ui`, `[14px]` → `text-body`, `[17px]`/`[18px]` → `text-title`. Map 20–24px to `h2`, 26–28px to `h1`, 30–32px to `hero`. Remove 10, 11.5 and 12.5px.
  - `rounded-[6px]` / `rounded-[3px]` → scale radii.
  - `text-faint` on **information** → `text-muted`:
    - task refs in `task-card.tsx`, `task-row.tsx`, `task-drawer.tsx`, `(app)/page.tsx`
    - section headings in `(app)/page.tsx`, `projects/page.tsx`, `task-drawer.tsx`, `sidebar.tsx`
    - counts in `sidebar.tsx`
    - times in `project-view.tsx`
  - `text-st-*` used as text → `text-*-text`; keep `bg-*` and `fill` with the solid tone.
- Page containers use `max-w-[var(--page-wide|medium|narrow)]` and the same `px-4 sm:px-8` everywhere (`project-view.tsx` currently uses `px-6` with no mobile step).
- Remove the alias tokens from P2-01.
- **Acceptance:** `grep -rE "text-\[(10|11\.5|12\.5|15|18|20|21|24|26|30|32)px\]" src` returns nothing, and screens look the same or better.

### P2-05 Separate colour meanings
- **DueChip** (`primitives.tsx`): overdue → `danger-soft/danger-text`; today or tomorrow → `soon-soft/soon-text`; later → muted. Add a fixed `min-w` so the due column lines up in rows.
- **BillableBadge:** a monochrome price tag, `bg-ink text-bg rounded-xs px-1 text-meta font-bold`, « € », with `aria-label="Hors périmètre, à facturer"`.
- **Quick-add token chips** (`quick-add.tsx`): priority urgent → danger, high → soon, medium → ink-2, low → muted; due → accent-soft; billable → ink; assignee → that member's soft colour.
- Replace the lucide `Hourglass` with `StatusIcon status="WAITING_CLIENT"` in `(app)/page.tsx` and `projects/page.tsx`.

### P2-06 People and project colours
- **New `PROJECT_COLORS`** (white text ≥ 4.9:1). Add a dark-mode variant map:

  | Name | Light | Dark |
  |---|---|---|
  | Rouge | `#ba362e` | `#ef675a` |
  | Orange | `#ad4a00` | `#e07937` |
  | Ocre | `#906200` | `#bf8f34` |
  | Vert | `#048149` | `#4ab074` |
  | Sarcelle | `#007c87` | `#39aab6` |
  | Cobalt | `#3065cc` | `#5c94ff` |
  | Indigo | `#6559c3` | `#9087f6` |
  | Prune | `#974992` | `#c876c1` |
  | Ardoise | `#606d7d` | `#8c9aab` |

- **Avatars:** switch to a **soft style**, so a member's colour can never read as a status (today Odo `#2B59F2` = progress, Hichem `#1D9A62` = done, Amine `#C98206` = waiting):
  - `background: color-mix(in oklch, var(--c) 18%, var(--surface))`
  - `color: color-mix(in oklch, var(--c) 70%, var(--ink))`
- Remove `ring-2 ring-surface` from the default avatar; keep it only in `AvatarStack` (new).
- **Small sizes:** `Avatar` and `ProjectTile` render initials or labels only when `size >= 20`; below that, a solid shape. Tile radius = `Math.round(size*0.28)`.
- **Backfill script:** `prisma/scripts/remap-colors.ts` maps each old hex to the nearest new one (dry-run by default).
- **Acceptance:** no initials below 20px, and no text-on-colour pair under 4.5:1.

### P2-07 Primitives library (`src/components/ui/`)
Create these; existing call sites migrate in P2-08.

| Component | Spec |
|---|---|
| `Button` | `variant`: primary (ink; accent in dark), accent, secondary (bordered), ghost, danger. `size`: sm `h-7 px-2.5 text-xs rounded-sm`, md `h-8 px-3 text-ui rounded-md`, lg `h-10 px-4 text-body rounded-md`, icon. States: `active:scale-[.98]`, `focus-visible:shadow-[var(--ring)] outline-hidden`, `disabled:opacity-45 pointer-events-none`. `loading` swaps the icon for a spinner and keeps the width fixed. |
| `IconButton` | Requires `label` (gives `aria-label` and the Tooltip). Hit area ≥ 24px, 44px under `@media (pointer: coarse)` via `after:absolute after:-inset-2`. |
| `Input`, `Textarea` | md 32px / lg 40px, focus `--ring`, `invalid` state with message and `aria-invalid` + `aria-describedby`. Inline-edit variant (transparent until hover/focus). **Font-size ≥ 16px under `pointer: coarse`.** |
| `Checkbox`, `Switch` | Replace the native inputs in `task-drawer.tsx` (billable), `task-list.tsx` (« Masquer les tâches faites »). |
| `SegmentedControl` | Extract from `task-list.tsx` and `project-dialogs.tsx`. |
| `Tabs` | Underline style, count badge, `role=tablist/tab/tabpanel`, arrow-key roving. |
| `Badge` | Tone × {soft, outline, solid}. One component for status, project status, role, « Bloqué », « À relancer ». |
| `Chip` | zone / due / billable / age. |
| `Tooltip` | 120ms delay, ink background, `text-meta`. Replaces every `title=` attribute (17 occurrences). |
| `Kbd` | One style, OS-aware (⌘ vs Ctrl). Replaces the custom kbd in `sidebar.tsx` and `new-task-button.tsx`. |
| `EmptyState` | 40px tinted icon tile + title + body + optional action. |
| `Skeleton` | line / row / card, shimmer `--sunken` → `--surface-2`, static under reduced motion. |
| `SectionHeader` | One style: `text-xs font-semibold text-muted`, sentence case, count in `text-faint` (the count is decorative because the number is also in the content). |
| `Menu` / `Select` | Rebuilt `SelectMenu`, see P5-02 (accessibility) and P1-07 (portal). |
| `DatePicker` | Popover with quick picks (Aujourd’hui, Demain, Lundi, +1 sem, Aucune) + month grid + a text field that accepts the quick-add date syntax (reuse `parseDue` from `quick-add.ts`). Replaces native `type=date` in the drawer, the recap dialog and the new-project dialog. |

### P2-08 Migrate call sites to the primitives
- Remove the ad-hoc buttons in `sidebar.tsx`, `task-drawer.tsx`, `login-form.tsx`, `dialog.tsx` and `project-note.tsx`.
- `Dialog` gets a `footer` slot so dialogs stop rebuilding `flex justify-end gap-2`.
- Unify disabled opacity.
- **Acceptance:** no raw `<button className="…bg-ink…">` left outside `ui/`.

### P2-09 Visual bug fixes
- **Timeline line broken into segments** (`project-view.tsx` ~l.230-235): put `border-l` on the inner content column inside the `li` with `pb-6`; the last item uses `border-transparent`. Timestamps go in two lines, Instrument Sans `tabular-nums`: « 7 oct. » in ink, « 15h21 » in muted.
- **Toasts:** `position="bottom-center"` (`layout.tsx`), so they no longer cover the drawer's comment button. Sonner gets `closeButtonAriaLabel="Fermer"` and `containerAriaLabel="Notifications"`.
- **Delete confirmation** in the drawer: keep one button that toggles label and tone, with a fixed width. Undo replaces it later (P3-04).
- The board's empty-column copy « Déposez une tâche ici » shows only while dragging; otherwise « Aucune tâche ».
- Drawer and dialogs use `--scrim`.
- **Favicon:** replace the default `src/app/favicon.ico` with `src/app/icon.svg` + `apple-icon.png`. **DECISION:** default to a geometric « S » mark in cobalt on ink if no brand asset is provided. Delete `public/{file,globe,next,vercel,window}.svg`.

### P2-10 The waiting-age chip (the product's signature)
- Add `AgeChip` in `primitives.tsx` with helper `waitingDays(statusChangedAt)`. Show it on `TaskCard` (footer), `TaskRow` (before the due date) and the drawer header whenever `status === "WAITING_CLIENT"`:
  - 0–2 days: muted
  - 3–4 days: `waiting-soft/waiting-text`
  - ≥ 5 days: solid waiting, bold, tooltip « À relancer »
- **Column header:** « Chez le client · 6 · la plus ancienne : 9 j ».
- **Acceptance:** visible on the board, the list and Aujourd’hui.

### P2-11 Project header compaction (`project-view.tsx`)
- **Row 1:** tile 32 · name (`text-h2`) · status badge-menu · site link icon · on the right: `Importer`, `Récap`, `Mise en ligne` (secondary sm) + **primary `Nouvelle tâche`**.
- **Row 2:** point d’étape clamped to one line in a `bg-surface-2` bar, with its date and an expand chevron.
- **Row 3:** tabs with counts (Tableau 24 · Liste · Mises en ligne 5 · Activité) + inline stat badges (`⧗ 3 · 9 j`, `€ 2`, lead avatar).
- **Show the project due date** (it is collected and never displayed).
- **Mobile:** actions go into a « ⋯ » menu; header details are collapsible.
- **Acceptance:** about 150px of chrome on desktop (down from about 260), and ≤ 35% of the viewport on a 667px-tall phone.

### P2-12 Board polish (`board.tsx`, `task-card.tsx`)
- **Layout:**
  - Columns `w-[272px]`.
  - The **Fait column collapses** by default to a 44px vertical rail (vertical label + count) and expands on click. When expanded it shows the 7 most recent tasks + « Voir les N autres ».
  - Column background `bg-sunken`; the waiting column `bg-waiting-soft/60`.
  - Drop target: `ring-2 ring-inset ring-accent/40` (a ring, not a background).
  - Sticky column headers.
  - A 2px accent drop indicator between cards.
- **Cards:**
  - Hide `PriorityIcon` when NONE, and hide `EmptyAvatar` unless the card is hovered or focused.
  - Move the ID to the footer next to the avatar.
  - Hover `shadow-raised -translate-y-px`.
- **Mobile:** `snap-x snap-mandatory`, columns `w-[85vw] snap-center`, a pill row of column names that scroll-jumps.

### P2-13 Theme switch
- Add Paramètres › Préférences: « Système / Clair / Sombre ». Store it in a cookie `theme` so the server renders `<html data-theme=…>` with no flash.
- In dark mode, the week-strip « today » cell becomes `bg-accent-soft text-accent ring-1 ring-accent/30`, not an inverted block.

### P2-14 Today page layout (`src/app/(app)/page.tsx`)
- Use a container query on `main` (`@container`; two columns at `@[1000px]`) instead of `xl:`, so the sidebar width counts.
- **Rail order:** Chez le client · À valider · Charge de l’équipe · Projets actifs · Dernières mises en ligne.
- Below the breakpoint, « Chez le client » comes **first**, as a horizontal strip of per-project cards with their age.
- **Stat cards:**
  - Replace « Mises en ligne 7 j » with « À attribuer ».
  - The cards become anchor links to their sections (`id` + `scroll-mt-6`).
- Use one `SectionHeader` style.
- Show a single progress representation (drop the duplicate percentage or the bar).
- Week strip on `max-sm`: day letter + number + dots.

### P2-15 Projects grid and Clients
- `projects/page.tsx`:
  - Remove the per-card status pill when grouped.
  - `line-clamp-3` on notes.
  - The empty note becomes an inline muted link « Ajouter un point d’étape ».
  - Hover: border + shadow only.
  - Filter chips (lead avatars, client) + a « Vue compacte » table toggle.
- `clients/page.tsx`: client initials tile; AGENCY clients show their end clients as nested rows. Text colours use the `-text` tokens.

### P2-16 Iconography
- Global lucide stroke width 1.75 (an `Icon` wrapper or `[&_.lucide]:stroke-[1.75]`).
- Sizes: 12px in chips, 14px inline with `text-ui`, 16px in buttons.
- Enlarge the hourglass glyph inside `StatusIcon` (path `M5.2 4.4h5.6L8 8l2.8 3.6H5.2L8 8Z`).

---

## Phase 3: Core UX

### P3-01 Tasks have URLs
- **Read first:** Next docs on `useSearchParams` (Suspense requirement), intercepting and parallel routes, `Link`.
- **Step 1 (this task):**
  - `openTaskId` in `src/components/app-context.tsx` is driven by the URL search param `?tache=BG-12`.
  - `openTask(id)` does `router.push(url, { scroll: false })` (or `history.pushState`, synced with `useSearchParams` as the Next 16 docs describe); closing goes `back()` when the drawer was opened in-app, otherwise `replace` without the param.
  - Resolve a ref to an id with a server lookup.
  - New route `src/app/(app)/t/[ref]/page.tsx` redirects to `/projects/<slug>?tache=<ref>`.
  - Drawer header buttons: « Copier le lien » (`https://…/t/BG-12`) and « Copier la référence ».
- **Step 2 (later, P5-12):** convert to an intercepting route `@drawer/(.)t/[ref]`, rendered on the server.
- **Acceptance:** refresh keeps the drawer open, the browser Back button closes it, and a pasted link opens the task.

### P3-02 Task search in the palette
- **Do:**
  - New `src/app/actions/search.ts` → `searchTasks(q)`:
    - If `q` matches `/^[A-Z][A-Z0-9]{0,5}-\d+$/i`, do an exact ref lookup.
    - Otherwise `ILIKE` on title, zone, source and project name, limit 20, excluding soft-deleted tasks (P3-04).
    - Then add `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm;` + a GIN index on `Task.title`, documented as a manual SQL step) and order by `similarity`.
  - Palette groups: **Tâches** (status icon, ref, title, project tile) · **Projets** · **Actions** (Importer des retours, Récap client, Mise en ligne, Relancer, Nouveau projet, Thème, Se déconnecter, each with its shortcut) · **Récemment consultées** (last 8 task ids in localStorage).
  - Debounce the queries (150ms).
- **Acceptance:** « BG-12 » + Enter opens the task; « médailles » finds it by title.

### P3-03 Today: every item is actionable
- **Do:**
  - Small client components `TaskLink` / `TaskRowActions` used by the server page.
  - « À valider » and « Chez le client » items open the drawer (today they are plain `li`/`span` or link to the project only).
  - **Row hover/focus actions:** status (portal menu) · « Me l’attribuer » (one click) · « Reporter ▾ » (Demain / Lundi prochain / +1 sem).
  - « Mes tâches » excludes my WAITING_CLIENT and REVIEW tasks from the actionable groups and shows them in a collapsed « Chez le client (3) » sub-group. Overdue never includes WAITING_CLIENT tasks.
  - **Team workload** counts only TODO + IN_PROGRESS, with waiting tasks shown as a secondary grey number. It excludes inactive users.
  - Week-strip days are buttons that open a popover of that day's tasks (no more `title`-only content).
- **Acceptance:** you can triage an overdue task from Aujourd’hui in ≤ 2 clicks without opening the drawer.

### P3-04 Soft delete + undo everywhere
- **Do:**
  - Add `Task.deletedAt DateTime?`.
  - Every task read in `dal.ts`, `actions/*`, `(app)/page.tsx`, `projects/[slug]/page.tsx` and search filters `deletedAt: null`. Prefer a Prisma client extension in `src/lib/db.ts` that injects it for `task.findMany/findFirst/count`, but keep `findUnique` explicit.
  - `deleteTask` sets `deletedAt`. Toast « BG-12 supprimée » + action « Annuler » (8 s) calls `restoreTask`. Remove the two-click confirm.
  - Undo also applies to status changes from rows and the board, and to bulk actions: the toast « Annuler » restores the previous status and position.
  - Purge job: delete rows with `deletedAt` older than 30 days (wired up in P6-04; until then, a manual script).
- **Acceptance:** delete followed by Annuler restores the task with its comments and history.

### P3-05 Filters and persisted views
- **Do:**
  - A filter bar on the board and the list: « Moi », assignee, zone, priority, source / round, billable, free text. State lives in the URL (`?f=…`) so it is shareable.
  - « Masquer Fait » and the grouping mode persist in the URL and localStorage (today they reset, `task-list.tsx`).
  - The `SavedView` model:
    ```prisma
    model SavedView { id String @id @default(cuid()); name String; filters Json; shared Boolean @default(false)
      userId String; user User @relation(fields: [userId], references: [id], onDelete: Cascade); createdAt DateTime @default(now()) }
    ```
  - Saved views appear in the sidebar.
  - New global page `/mes-taches`: my tasks across projects, with the same filter bar.
- **Acceptance:** filter « Moi + Homepage », reload: the filter is kept, and the link works for a colleague.

### P3-06 Bulk actions
- **Do:**
  - Multi-select in the list and on Aujourd’hui: `X` toggles, Shift+click / Shift+↓ extends, Ctrl+A selects the group.
  - A sticky ink pill: « 8 sélectionnées · Statut · Attribuer · Priorité · Échéance · Page · € · Supprimer ».
  - Server: `bulkUpdateTasks(ids, patch)` in one transaction, writing one activity row (« a passé 8 tâches en Fait »), with undo (P3-04).
- **Acceptance:** assign 20 imported tasks in 3 clicks.

### P3-07 Keyboard layer
- **Do:**
  - `src/lib/hotkeys.ts`: a central hook with an **overlay stack** (Escape closes only the top layer: popover, then palette, then dialog, then drawer).
  - It ignores keys while typing (input, textarea, contenteditable) and while IME composition is active.
  - Match letters on `event.key` and digits on `event.code` (the team uses AZERTY).
- **Shortcut map:**

  | Scope | Keys | Action |
  |---|---|---|
  | Global | Ctrl/⌘K | Palette |
  | Global | C | New task |
  | Global | / | Filter or search |
  | Global | ? | Shortcut sheet |
  | Global | G then A / P / C / S / M | Aujourd’hui / Projets / Clients / Paramètres / Mes tâches |
  | Global | Ctrl/⌘Z | Undo last action |
  | Project | V then T / L / M / H | Tableau / Liste / Mises en ligne / Historique |
  | Project | Shift+I / Shift+R / Shift+D / Shift+N | Import / Recap / Mise en ligne / Point d’étape |
  | Project | F | Filters |
  | Project | Shift+M | « Moi » toggle |
  | Lists & board | J / K or ↓ / ↑ | Next / previous task |
  | Lists & board | H / L | Previous / next column |
  | Lists & board | Enter / O | Open |
  | Lists & board | X | Select |
  | Lists & board | Alt+← / → | Move status |
  | Lists & board | Alt+↑ / ↓ | Reorder |
  | Task (focused, selected or drawer) | S | Status menu (typeahead: a / e / c / v / f) |
  | Task | D | Fait |
  | Task | W | Chez le client |
  | Task | A | Attribuer |
  | Task | M | Me l’attribuer |
  | Task | P | Priority (u / h / m / b / 0) |
  | Task | E | Échéance (text field using quick-add date syntax) |
  | Task | Z | Page / zone |
  | Task | $ | Toggle hors périmètre |
  | Task | R | Rename |
  | Task | Y | Copy link |
  | Task | Suppr | Delete (with undo) |
  | Drawer | J / K | Next / previous task in the source list |
  | Drawer | Ctrl+Enter | Send comment |
  | Drawer | Esc | Save drafts and close, returning focus to the row |

- **Shortcut sheet:** `src/components/shortcut-sheet.tsx` (modal, grouped, searchable). Button tooltips show their `Kbd`; palette actions list their shortcut.
- **Preference** « Raccourcis à une touche » (on by default; WCAG 2.1.4): when off, single-letter shortcuts need Alt.
- The `C` shortcut must not fire when a dialog, the drawer or the palette is open.
- **Acceptance:** the whole triage loop works without a mouse.

### P3-08 Quick-add improvements
- **Do:**
  - Popovers for `@` (team, active only) and `#` (existing zones of the project).
  - Chips are removable (× puts the word back into the title).
  - **Date words are only parsed as dates in the last 3 tokens**, so « Changer le visuel du lundi » keeps « lundi ».
  - `\` escapes a token (`\#2` stays literal).
  - Inline highlighting: a mirror `div` behind a transparent input renders the tokens as coloured spans, Todoist-style. This replaces the separate preview row, but keep an `aria-live` summary (« Attribuée à Odo, priorité haute, échéance demain »).
  - Optimistic insert: the new card appears at the **top** of its column with a flash (position = first − 1000 when created from a column quick-add).
- **Acceptance:** none of the edge cases above lose words; the preview equals the result.

### P3-09 Project and client editing, archive
- **Do:**
  - `ProjectSettingsDialog`: name, key (warn that existing refs change their prefix; **DECISION:** block key edits once tasks exist), client, end client, site URL, colour, lead, due date, type (P4-09).
  - Archive button calls the existing, currently unused `archiveProject` in `src/app/actions/projects.ts`.
  - An « Archivés » section on `/projects`, with unarchive.
  - `src/app/actions/clients.ts`: create/edit client (name, kind, notes) + contacts (P4-04).
  - `clients/page.tsx` becomes editable.
- **Acceptance:** no field needs a database edit any more.

### P3-10 Member lifecycle
- **Do:**
  - Paramètres › Équipe member menu: Modifier (name, email, colour) / Passer admin ↔ membre / **Désactiver** (`User.active=false`, bump `sessionVersion`).
  - Inactive members are hidden from `getTeam()` (add `where: { active: true }`), assignee menus, workload and `@` suggestions. Tasks stay assigned, with a « (inactif) » suffix.
  - Guard: you can't deactivate or demote the last active admin.

### P3-11 Onboarding and empty states
- **Do:**
  - A new project's empty state offers 3 big actions: « Coller un tableau de retours » / « Ajouter une tâche (C) » / « Écrire le point d’étape ».
  - A first-login checklist card on Aujourd’hui (dismissible, stored per user in `User.onboardingDismissedAt`): change your code · create a task with the syntax · open Ctrl K · press ?.
  - Every empty list uses `EmptyState` with a next action.

### P3-12 Freshness between teammates (cheap version)
- **Do:** in `AppProvider`, call `router.refresh()` on `visibilitychange` (when the tab becomes visible) and every 60 s while visible and idle (no open dialog, no drag, no focused input). Show a small « Mis à jour il y a 2 min » in the sidebar footer.
- The real-time version is P7-12.

---

## Phase 4: Domain model (history, import, chasing, rounds, deliveries)

### P4-01 Structured activity (do early: lost history can't be recovered)
- **Schema:**
  ```prisma
  enum ActivityType { NOTE TASK_CREATED STATUS_CHANGED ASSIGNED BILLABLE_CHANGED DUE_CHANGED PRIORITY_CHANGED TITLE_CHANGED
                      COMMENTED TASK_DELETED TASK_RESTORED IMPORTED DELIVERED CLIENT_MESSAGE PROJECT_UPDATED }
  model Activity {
    // existing fields…
    type       ActivityType @default(NOTE)
    fromStatus TaskStatus?
    toStatus   TaskStatus?
    data       Json?        // { from, to } for assignee/due/billable/priority/title
    @@index([taskId, createdAt])
    @@index([type, createdAt])
  }
  ```
- **Do:**
  - Replace `log()` in each action file with a shared `src/lib/activity.ts` helper: `logActivity(tx, { type, projectId, taskId, actorId, from, to, data })`. It renders the French `message` from the type (one place for copy) and runs **inside the same transaction** as the change.
  - Log **every** field change: billable, due date, priority, title. Today only status and assignee are logged, and billable is the field that matters in a dispute.
  - Project status changes log from → to (today: « a changé le statut du projet »).
- **Acceptance:** each status change produces a row with `fromStatus`/`toStatus`. Existing feeds still render.

### P4-02 Task status time ledger
- **Do:**
  - Add `Task.waitingSince DateTime?`, set when entering WAITING_CLIENT and cleared when leaving. Keep `statusChangedAt` too.
  - `src/lib/metrics.ts` → `timeInStatus(taskId)` and `projectWaitingDays(projectId, from, to)`, computed from the `STATUS_CHANGED` rows.
- Unit-test the interval maths with synthetic event lists.

### P4-03 Import dedupe and diff preview
- **Do:**
  - Add `Task.externalKey String?` and `@@unique([projectId, externalKey])` (several NULLs are allowed in Postgres).
  - `externalKey = sha1(normalize(zone) + "|" + normalize(retour))`, where `normalize` lowercases, strips accents, collapses whitespace and strips punctuation.
  - Backfill `externalKey` for existing tasks whose `source` starts with « Retours » (script, dry-run by default).
  - **The preview becomes an editable table:**
    - Each row has a checkbox, an editable page and status, and a badge: « Nouvelle » / « Déjà importée (BG-14) » / « État modifié : Fait → Pas fait ».
    - For existing rows, offer « Mettre à jour l’état » (default when the state changed), « Ignorer » (default otherwise) or « Créer quand même ».
    - Footer: « Attribuer à [▾] », « Priorité », « Échéance » for all rows. The button reads « Créer 18 tâches · mettre à jour 4 ».
  - **Column mapper:** when headers are ambiguous (`feedback-import.ts` only recognises cells starting with « retour » or « page »), show « Colonne Retour = [C ▾] » selects. Widen detection to synonyms: écran, demande, modification, commentaire client, statut.
  - Use the sheet's date column as the received date (stored on the round, P4-06).
  - After the import, land on the list filtered by this import's source, with the new tasks selected (ready for bulk actions).
  - **Paste anywhere on a project page:** a `paste` listener that detects TSV with ≥ 2 columns and ≥ 2 rows (and focus not in an input) opens the import dialog pre-filled.
- **Acceptance:** re-pasting the same sheet creates 0 tasks; changing one cell's « État » proposes exactly 1 update.

### P4-04 Structured client contacts
- **Schema:**
  ```prisma
  model Contact { id String @id @default(cuid()); name String; role String?; email String? @unique; phone String?
    isPrimary Boolean @default(false); clientId String; client Client @relation(fields: [clientId], references: [id], onDelete: Cascade)
    createdAt DateTime @default(now()) }
  ```
- Keep `Client.contacts String?` as legacy.
- Backfill: split on commas, parsing « Nom (rôle) ». Dry-run by default.
- The UI from P3-09 edits contacts. The project header shows the primary contact (name + copyable email) instead of a `title` tooltip.

### P4-05 « Relancer » (chasing the client)
- **Schema:**
  - `Task.waitingFor String?` (« visuels HD », « textes page À propos »)
  - `Task.followUpAt DateTime?`
  - `Task.lastChasedAt DateTime?`
  - `Project.lastChasedAt DateTime?`
  - `ClientMessage`:
    ```prisma
    enum MessageKind { RECAP FOLLOW_UP QUOTE }
    enum Channel { WEB EMAIL WHATSAPP CALL PORTAL API MCP DEPLOY SHEETS WIDGET CHAT SYSTEM }
    model ClientMessage { id String @id @default(cuid()); kind MessageKind; body String; sentAt DateTime @default(now())
      via Channel @default(EMAIL); since DateTime?; projectId String; project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
      toId String?; to Contact? @relation(fields: [toId], references: [id], onDelete: SetNull)
      authorId String?; author User? @relation(fields: [authorId], references: [id], onDelete: SetNull)
      tasks Task[] @relation("MessageTasks")
      @@index([projectId, sentAt]) }
    ```
- **UI:**
  - Moving a task to « Chez le client » opens an optional inline popover: « On attend : [___] · relancer le [lun. ▾] ».
  - A « Relancer » button on each project in Aujourd’hui's « Chez le client » panel and in the project header. It opens a dialog with a generated message:
    - « Bonjour {prénom du contact principal}, »
    - one line per waiting item: « {titre} ({page}) : en attente depuis le 03/10 »
    - a polite closing and the user's signature « {Prénom} · Suzali Conseil »
  - Buttons: « Copier » / « Ouvrir dans la messagerie » (`mailto:` with subject « {Projet} : éléments en attente »). Either one logs a `ClientMessage(FOLLOW_UP)`, sets `lastChasedAt` on the project and the tasks, and logs a `CLIENT_MESSAGE` activity.
  - **« À relancer » rule:** `max(waitingSince, lastChasedAt) <= now − 5 days` (5 becomes a project setting later). The badge becomes « Relancé il y a 1 j · prochaine relance jeu. ».
- **Acceptance:** after a chase, the project leaves « À relancer » for 5 days, and the history shows the message.

### P4-06 Feedback rounds as real objects
- **Schema:**
  ```prisma
  enum RoundStatus { OPEN DELIVERED CLOSED }
  model FeedbackRound { id String @id @default(cuid()); label String; receivedAt DateTime @default(now())
    channel Channel @default(SHEETS); sheetUrl String?; rawText String?; status RoundStatus @default(OPEN)
    projectId String; project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
    fromContactId String?; fromContact Contact? @relation(fields: [fromContactId], references: [id], onDelete: SetNull)
    closedById String?; closedBy Delivery? @relation(fields: [closedById], references: [id], onDelete: SetNull)
    tasks Task[]; createdAt DateTime @default(now()); @@index([projectId, receivedAt]) }
  ```
  plus `Task.roundId String?`.
- **Do:**
  - Every import creates a round, storing the raw paste as proof, with « De la part de [contact ▾] ».
  - A new project tab « Retours »: one card per round with done / chez le client / restant counts, and « Clôturer avec la mise en ligne… ».
  - Quick-add and the palette can target the current open round.
  - Backfill: group existing tasks by `source`.
- **Acceptance:** the round card counts match the tasks.

### P4-07 Deliveries contain tasks
- **Schema:**
  - `model DeliveryTask { deliveryId String; taskId String; @@id([deliveryId, taskId]) }`
  - Delivery gets `source Channel @default(WEB)`, `externalId String? @unique`, `commitSha String?`, `context String?`, `confirmedAt DateTime?`.
- **DeliveryDialog:**
  - Pre-ticks all tasks DONE or REVIEW since the previous delivery: « Inclure 9 tâches ».
  - Checkbox « Passer les 3 “À valider” en Fait ».
  - Suggests a title from the pages involved (« Corrections Homepage, Fiche produit »).
  - Lets you close the open round(s).
- After saving, the toast offers « Préparer le récap client → ».
- Deliveries can be edited and deleted (soft delete with undo).
- The timeline shows each delivery's task list (collapsible).

### P4-08 Recap v2
- **Do:**
  - The dialog **generates on open**. The default « since » is the most recent of (the last recap sent, the last delivery). Reset state on close (today the old text persists, `project-dialogs.tsx`).
  - Template by `Client.kind`:
    - **AGENCY:** technical, with refs. A « marque blanche » toggle removes the Suzali mention.
    - **DIRECT:** plain language, no internal statuses. REVIEW items never show as « (à valider) »; they show as « en cours de finalisation ».
  - Greeting with the primary contact's first name, and a signature.
  - Optional sections: hors périmètre items (« Modifications supplémentaires réalisées »); waiting items with « depuis le … ».
  - Editing the text and then changing a toggle warns « Régénérer va remplacer vos modifications ».
  - « Copier » / « Copier en HTML » / « Ouvrir dans la messagerie » log a `ClientMessage(RECAP)`. The header shows « Dernier récap envoyé il y a 4 j ».

### P4-09 Project type, templates, zones
- **Schema:**
  - `enum ProjectType { VITRINE ECOMMERCE REFONTE MAINTENANCE SOCIAL OTHER }` and `Project.type`, `startDate`.
  - `Zone { id, name, url?, position, projectId, @@unique([projectId, name]) }` and `Task.zoneId`. Keep `Task.zone` as the label during the transition.
  - `ProjectTemplate { name, type, milestones String[], zones String[], tasks TemplateTask[] }`.
  - `TemplateTask { title, zone?, milestone?, estimateMin?, offsetDays?, position }`.
  - `Milestone { name, dueDate?, completedAt?, position, projectId }` and `Task.milestoneId`.
- **Do:**
  - « Nouveau projet » → choose a template: milestones, zones and starter tasks are created with relative deadlines.
  - Add `/settings/templates` to manage templates.
  - The `#` autocomplete (P3-08) uses `Zone`. A « Fusionner les pages » tool in project settings merges zone spellings (« Homepage » / « Accueil » / « Home »).
  - Seed 3 templates: Site vitrine, E-commerce, Réseaux sociaux.

### P4-10 Billable amounts → extras (avenants)
- **Step 1:**
  - `Task.billingNote String?`, `Task.estimatedAmountCents Int?`.
  - The `$` quick-add token accepts `$150`.
  - The project header shows « 3 hors périmètre · 450 € à chiffrer ».
- **Step 2:**
  ```prisma
  enum ExtraStatus { DRAFT QUOTED APPROVED REJECTED INVOICED PAID }
  model Extra { id String @id @default(cuid()); number Int; title String; amountCents Int?; status ExtraStatus @default(DRAFT)
    quotedAt DateTime?; approvedAt DateTime?; approvedBy String?; invoicedAt DateTime?; invoiceRef String?
    projectId String; project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
    tasks Task[]; createdAt DateTime @default(now()); @@unique([projectId, number]); @@index([status]) }
  ```
  - An « Avenants » project tab groups billable tasks into extras: DRAFT → QUOTED (generates a `ClientMessage(QUOTE)`) → APPROVED → INVOICED.
  - A `/facturation` page lists approved-but-not-invoiced extras by client and month, with CSV export.
  - **Never number invoices in this app.** See P8-03.

### P4-11 Estimates and light time tracking
- **Schema:**
  - `Task.estimateMin Int?`
  - `TimeEntry { date @db.Date, minutes, note?, billable, userId, projectId, taskId? }`
  - `User.weeklyCapacityMin Int?`
  - `Project.budgetMinutes Int?`, `budgetCents Int?`, `dayRateCents Int?`
- **Do:**
  - An estimate picker (15m / 30m / 1h / 2h / 4h / 1j).
  - An optional timer in the drawer header and a weekly timesheet grid at `/temps`.
  - The project header shows « Temps passé / vendu : 31 h / 40 h ».
  - Workload on Aujourd’hui = sum of estimates versus capacity, when they exist.
  - **Optional, never mandatory.**

### P4-12 Checklists and attachments
- **Schema:**
  - `ChecklistItem { label, done, position, taskId }`
  - `Attachment { name, storageKey, mimeType, sizeBytes, taskId?, deliveryId?, roundId?, uploaderId, kind String @default("FILE") }`
- **Storage:** a private Supabase Storage bucket served through signed URLs. Add `@supabase/supabase-js` (server-side only, service key in env `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`).
- **Uploads:** `actions/uploads.ts` returns a signed upload URL; the client uploads directly, so big files never pass through the function.
- **UI:**
  - Paste or drop an image into the description or a comment to upload it.
  - Thumbnails on cards.
  - A checklist in the drawer, with progress on the card.
- **Note:** update the README RLS section for storage bucket policies.

### P4-13 Recurring tasks
- `RecurringTask { title, zone?, assigneeId?, rrule String, nextRunAt, projectId }`.
- Presets: every Monday, 1st of the month, every 2 weeks.
- Created by the daily job (P6-04). The UI lives in project settings.

### P4-14 Comments: mentions and notifications (in-app)
- **Schema:**
  ```prisma
  enum NotificationKind { ASSIGNED MENTIONED COMMENT_ON_MY_TASK CLIENT_REPLIED WAITING_OVERDUE EXTRA_APPROVED DELIVERY_DETECTED }
  model Notification { id String @id @default(cuid()); kind NotificationKind; readAt DateTime?; createdAt DateTime @default(now())
    userId String; user User @relation(fields: [userId], references: [id], onDelete: Cascade); taskId String?; projectId String?; actorId String?
    @@index([userId, readAt, createdAt]) }
  ```
- **Do:**
  - `@prénom` in comments, using the same resolution as quick-add (with an ambiguity picker).
  - A bell with an unread count in the sidebar opens an « Pour moi » inbox page.
  - Create notifications in the same transaction as the change.
  - `User.lastSeenAt` drives a « Depuis hier » strip on Aujourd’hui (« Anaïs a passé 4 tâches en Fait sur Bières Georges · Hichem vous a attribué BG-31 »).

### P4-15 Reports page
- `/rapports` (admin by default), built from the P4-01/P4-02 data:
  - days « chez le client » per client and project
  - median client response time
  - deliveries per month
  - billable € per month and client
  - tasks per round
  - cycle time
- Before building it, load the `dataviz` skill for the chart guidance. Charts can be SVG rendered on the server.

---

## Phase 5: Accessibility (WCAG 2.2 AA), mobile, performance

### P5-01 Dialog on native `<dialog>`
- Rewrite `src/components/dialog.tsx`:
  - `ref.showModal()` when open (top layer, inert background, built-in focus handling).
  - The `cancel` event calls `onClose`; a click on the backdrop (`e.target === ref.current`) closes.
  - `aria-labelledby` / `aria-describedby` via `useId`.
  - Restore focus to the previously active element on close.
  - Exit animation: keep it mounted 160ms with `data-state="closed"`.
- **Mobile (`max-sm`):** a bottom sheet (`items-end`, `max-h-[90dvh]`, sticky footer, grab handle). Use `dvh`, not `vh`.
- Reuse the same approach for the task drawer (right-aligned, with `aria-modal`, focus moved to the title once loaded, `aria-busy` while loading) and for the mobile nav (`aria-expanded`/`aria-controls` on the menu button, Escape closes, first link focused).
- Command palette → `Command.Dialog` from cmdk.

### P5-02 Accessible Select / Menu
- **Rebuild `select-menu.tsx`** following the WAI-ARIA APG « select-only combobox » pattern:
  - The trigger's accessible name includes the value: `${label} : ${current}`.
  - Option ids and `aria-activedescendant`. `aria-selected` marks the chosen value.
  - Home/End and typeahead.
  - Tab closes the menu; focus returns to the trigger on select and on Escape.
  - **Remove the focusable `aria-hidden` input.**
  - Sections and shortcut hints.
- Keep the portal from P1-07.
- **Acceptance:** vitest-axe passes, and the keyboard tests in P0/P5 pass.

### P5-03 Board: keyboard, screen reader, touch
- **Do:**
  - One focusable element per card. `TaskCard` is a real `<button>` (opens the task) and also the dnd-kit activator (`setActivatorNodeRef`). Remove `role`/`tabIndex` from the wrapper attributes.
  - `KeyboardSensor` with `keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] }`, so Enter opens and Space lifts.
  - French announcements via the `accessibility` prop on `DndContext`: `screenReaderInstructions` and `announcements` using the task title and the column label (« BG-12 déplacée dans En cours, position 3 sur 7 »).
  - Sensors: `MouseSensor({ distance: 6 })` + `TouchSensor({ delay: 220, tolerance: 6 })` + Keyboard. Cards get `touch-action: manipulation`.
  - **A no-drag alternative** (WCAG 2.5.7): a « Déplacer vers… » status menu on each card (visible on hover/focus, always on touch).
  - Turn off the drop animation under `prefers-reduced-motion`.
  - Default to the **Liste** view under 768px.

### P5-04 Contrast and focus visibility
- Verify with the P2-01 script plus axe.
- Remove every `outline-none` that has no replacement (`task-drawer.tsx` TitleField/Description/date, `dialog.tsx` fieldClass, `quick-add.tsx`). Use `outline-hidden` plus a `focus-visible` ring, so focus stays visible in Windows forced-colors mode.
- Input boundaries need ≥ 3:1 against their background (WCAG 1.4.11). Use a stronger border on inputs (≈ `#8a8f98` light).

### P5-05 Screen-reader semantics
- **Live announcements:** one `aria-live="polite"` region in `AppProvider` with an `announce(text)` helper. Call it on move, status change, save, create, delete/undo, and bulk actions.
- **Labels on visual-only elements:**
  - `TaskRow` gets an sr-only status label.
  - `Avatar` gets `role="img" aria-label={name}`; EmptyAvatar gets « Non attribuée ».
  - `PriorityIcon` gets `role="img"`.
  - The sidebar waiting dot gets an sr-only « En attente client ».
  - Zone progress bars get `role="img" aria-label`.
- **Errors:** `role="alert"` on form errors (NewProject…).
- **Headings:** fix the hierarchy (board columns `h2`, drawer sections `h2`, delivered-projects summary).
- **Skip link:** « Aller au contenu » plus `id="main"`.
- Project tabs follow the proper tabs pattern (P2-07 `Tabs`).
- The delete-confirm focus problem disappears with undo (P3-04).

### P5-06 PIN input
- Rebuild `pin-input.tsx` as **one** `<input type="password" inputMode="numeric" autoComplete="current-password|new-password" pattern="\d{6}" maxLength={6}>` visually overlaid on 6 boxes (the input-otp technique), with an eye toggle to reveal. Replace `autoComplete="one-time-code"`.
- Visible legend; `aria-invalid` and `aria-describedby` linked to the error.
- After a failed login, refocus the field. For a returning user, focus the PIN after hydration (`useEffect` on `knownEmail`).
- **Keep the « 6th digit » auto-submit fix from commit `9abf4da` and add a regression test** (the hidden value is set before `onComplete`).

### P5-07 Mobile
- **Inputs:** a global rule `@media (pointer: coarse) { input, textarea, select { font-size: max(16px, 1em) } }` stops iOS zooming on focus.
- **Safe areas:** `viewport.viewportFit = "cover"`; safe-area padding on the mobile bar, drawer footer, sidebar footer and dialogs.
- **Touch targets:** ≥ 44px under `pointer: coarse` (sidebar `+` is ≈18px, the column `+` ≈20px, the row status trigger ≈23px).
- **Hover-only content** (the project-note pencil, tooltips) is always visible under `@media (hover: none)`.
- **Project page on phones:**
  - a sticky bottom action bar (Ajouter · Importer · Mise en ligne)
  - row swipe actions (right = Fait, left = Chez le client)
  - the drawer is full-screen with swipe-down to close
- **Week strip:** `overflow-x-auto snap-x` on `max-sm`.

### P5-08 PWA basics
- `src/app/manifest.ts`:
  - `name: "Suzali Tasks"`
  - `lang: "fr"`
  - `display: "standalone"`
  - `start_url: "/"`
  - `theme_color`
  - icons from P2-09
  - `shortcuts`: Nouvelle tâche, Aujourd’hui
- **Exclude** `manifest.webmanifest`, `/icon*`, `/apple-icon*` and (later) `/sw.js` from the proxy matcher in `src/proxy.ts`, or logged-out manifest fetches are redirected to /login.

### P5-09 `loading.tsx` and navigation feedback
- **Read first:** `node_modules/next/dist/docs/**/loading.md` and the prefetching guide. Without a loading boundary, dynamic routes are not prefetched.
- Add:
  - `(app)/loading.tsx`
  - `(app)/projects/loading.tsx`
  - `(app)/projects/[slug]/loading.tsx` (header + 5 column shells × 3 card skeletons)
  - `(app)/settings/loading.tsx`
- Use `useLinkStatus` for a pending dot on sidebar links.

### P5-10 Query performance
- **Indexes:**
  - `Comment @@index([taskId, createdAt])`
  - `Activity @@index([taskId, createdAt])` (from P4-01)
  - `Delivery @@index([projectId, deployedAt])` and `@@index([deployedAt])`
  - `Task @@index([status, statusChangedAt])` and `@@index([assigneeId, status, dueDate])`
  - `Project @@index([clientId])`
- **Project page:**
  - Load DONE tasks from the last 14 days only, plus a count; « Voir les N tâches faites » loads the rest.
  - Deliveries and activity become separate server components rendered per tab inside `<Suspense>`.
  - Switching tabs uses `history.replaceState` instead of `router.replace` (no server round trip).
- **Aujourd’hui:** reuse the cached `getTeam()` instead of re-querying; run the independent queries in `Promise.all`.
- **Actions:** batch writes in `$transaction([...])`; drop the extra `findUnique` round trips where `select` suffices.
- **`.env.example`:** `DATABASE_URL=…?pgbouncer=true&connection_limit=1&pool_timeout=20`, with a comment.

### P5-11 Bundle weight
- `next/dynamic` / `React.lazy` for:
  - `CommandPalette` (load on the first Ctrl+K)
  - `NewProjectDialog`, `NewTaskDialog`, `TaskDrawer`
  - `ImportDialog`, `RecapDialog`, `DeliveryDialog`
  - `Board` (lazy per tab, so dnd-kit isn't loaded for Liste)
- Format dates on the server where possible.
- **Context split:** `AppDataContext` (user/team/projects/clients) + `AppActionsContext` (stable callbacks) + UI-state contexts; `React.memo(TaskCard)` and `TaskRow`.
- **Budget:** `/clients` first-load JS ≤ 520 KB uncompressed (636 KB today), `/projects/[slug]` ≤ 600 KB (708 KB today). Measure from `.next/diagnostics/route-bundle-stats.json`.

### P5-12 Drawer as an intercepting route
- **Read first:** Next docs on parallel and intercepting routes.
- `src/app/(app)/@drawer/(.)t/[ref]/page.tsx` renders the drawer over the current page; `src/app/(app)/t/[ref]/page.tsx` renders the full task page on a hard load. Task detail is read on the server (no more reads through a Server Action, which queue behind writes).
- Move the drawer's mutations to `useOptimistic` and drop the post-patch `load()`.
- Replaces the step 1 mechanism from P3-01.

### P5-13 Cache Components (evaluate, then migrate route by route)
- **Read first:** `node_modules/next/dist/docs/**/cache-components*`, `authentication-with-cache-components.md`, `updateTag`, `cacheTag`.
- **Plan:**
  - Team-wide data (projects, team, clients, a project's tasks) becomes `'use cache'` + `cacheTag('project:'+id)` / `cacheTag('nav')`.
  - The user-specific parts (current user badge, « mes tâches ») stream per request inside `<Suspense>`.
  - Mutations call `updateTag` instead of `revalidatePath("/", "layout")`.
  - Then evaluate partial prefetching.
- **DECISION:** do this only after P5-12. Migrate one route at a time behind the documented per-route escape hatch.

### P5-14 Component tests
- `pin-input.dom.test.tsx`, `select-menu.dom.test.tsx`, `dialog.dom.test.tsx`.
- Cover the keyboard behaviours from P5-01/02/06, plus `vitest-axe` with no violations.

### P5-15 End-to-end tests and CI e2e job
- **Setup:** add `@playwright/test` and `@axe-core/playwright`.
- **`playwright.config.ts`:**
  - Projects `chromium-desktop` and `webkit-iphone13`.
  - `timezoneId: "Europe/Paris"`, `locale: "fr-FR"`.
  - `webServer` runs `npm run build && npm start` with `TZ=UTC`, so the server runs in UTC as in production.
  - `global-setup.ts` logs in through the UI once and saves `storageState`.
- **Specs:**
  - `auth`: login, lockout, `?next=`.
  - `quick-add`.
  - `board.keyboard` and `board.touch`.
  - `drawer`: focus in, Escape restores focus, missing-task state.
  - `delivery-timezone`: 14h30 shows as 14h30, no hydration error in the console.
  - `import`: 60 rows in under 5 s; a re-import creates 0 tasks.
  - `a11y`: axe with wcag2a/2aa/21aa/22aa on every route plus the open drawer and dialog, in light and dark.
  - `mobile`: input font ≥ 16px, no horizontal overflow, nav Escape.
- **CI job `e2e`:**
  - `services: postgres:16`
  - `npx prisma db push`
  - `npm run db:seed` with `SEED_PASSWORD=275039`
  - `npx playwright install --with-deps chromium webkit`
  - upload `playwright-report/`
- **CI job `budget`:** fails when first-load JS exceeds the P5-11 budgets.
- **Human step (DECISION):** protect `main` with required checks.

---

## Phase 6: Platform foundation for integrations

> Required before any webhook, cron, API, MCP or portal work.

### P6-01 Proxy public allowlist
- **Cause:** `src/proxy.ts` redirects every request without a cookie to `/login`, which breaks webhooks, OAuth callbacks, the manifest, ICS feeds and portal pages.
- **Fix:**
  ```ts
  const PUBLIC = ["/login", "/api/hooks/", "/api/cron/", "/api/v1/", "/api/mcp", "/api/auth/", "/api/ics/",
    "/api/widget/", "/p/", "/widget.js", "/sw.js", "/manifest.webmanifest", "/icon", "/apple-icon"];
  ```
- Each public route authenticates itself (signature, token, API key).
- Keep **no secret** in the proxy (Netlify secret scanning, see commit history).

### P6-02 Service layer with an Actor
- **Do:**
  - Create `src/lib/services/{tasks,projects,deliveries,comments,search}.ts`, all with `import "server-only"`.
  - `type Actor = { userId: string | null; via: Channel }`.
  - Move the business logic out of `"use server"` files: `insertTask`, `createTasks` (bulk, from P1-10), `updateTask`, `moveTask`, `recordDelivery`, `buildRecapFacts`.
  - Server Actions become thin: `verifySession()` → zod-parse the input → service → revalidate.
  - Add `zod` and validate every action input.
- **Acceptance:** no business logic remains in `src/app/actions/*` beyond auth, validation and revalidation.

### P6-03 Event outbox
- **Schema:**
  ```prisma
  model Event { id String @id @default(cuid()); type String; payload Json; via Channel @default(WEB)
    projectId String?; taskId String?; actorId String?; createdAt DateTime @default(now()); dispatchedAt DateTime?
    @@index([dispatchedAt, createdAt]); @@index([projectId, createdAt]) }
  ```
- Services write events **in the same transaction** as the change. Types:
  - `task.created`, `task.status_changed`, `task.assigned`, `task.updated`, `task.deleted`
  - `comment.created`
  - `delivery.created`
  - `project.note_updated`
  - `client_message.sent`
- Activity (P4-01) keeps serving the UI; Event feeds notifications, webhooks, realtime and sync.

### P6-04 Job queue and cron
- **Schema:**
  ```prisma
  model Job { id String @id @default(cuid()); kind String; payload Json @default("{}"); runAt DateTime @default(now())
    attempts Int @default(0); lockedAt DateTime?; doneAt DateTime?; lastError String?; dedupeKey String? @unique
    @@index([doneAt, runAt]) }
  ```
- **Route** `src/app/api/cron/tick/route.ts`:
  - `export const maxDuration = 60`
  - Bearer `CRON_SECRET`, compared with `timingSafeEqual`.
  - Claims up to 10 jobs with `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING *`.
  - Exponential backoff (`runAt = now() + 2^attempts min`); give up after 6 attempts.
- **Scheduler (DECISION, default):** Supabase `pg_cron` + `pg_net` calls `/api/cron/tick` every minute, so it works the same on Netlify and Vercel. Document the SQL in the README; the secret lives in Supabase Vault. A human runs this.
- The tick inserts the recurring jobs with `dedupeKey`:
  - `dispatch_events` (every tick)
  - `daily:YYYY-MM-DD` (chase alerts, recurring tasks, soft-delete purge)
  - `digest:YYYY-Www`
- **Integrations panel** in Paramètres (admin): last webhook received per provider, failed jobs with « Relancer », last error.

### P6-05 Env validation, observability, backups
- `src/lib/env.ts` validates env vars with zod; import it in `instrumentation.ts` so a misconfigured deploy fails fast.
- Add `@sentry/nextjs` via `instrumentation.ts` (`onRequestError`), tagging `via` and `projectKey`. Add a cron heartbeat.
- **Backups (human, DECISION):**
  - Supabase Pro (daily backups; the free tier also pauses after inactivity).
  - A nightly GitHub Action runs `pg_dump -Fc`, encrypts with `age`, and uploads to an EU bucket.
  - A restore drill every quarter.
- `LoginEvent { userId?, email, success, ip, ua, createdAt }`, and a « Journal » view in Paramètres.

### P6-06 Rate limiting
- A `RateLimit` table in Postgres (key, window start, count) with an atomic upsert. Or Upstash, if the human prefers (DECISION: Postgres).
- Key on IP (`x-nf-client-connection-ip` / `x-forwarded-for`) for login, portal, widget, webhooks and the API.

---

## Phase 7: Integrations and AI

> Model IDs: `claude-sonnet-5-5` (default), `claude-haiku-5-5` (cheap classification), `claude-opus-5-5` (long or messy inputs, tone rewriting).
> **Before writing any Claude API code, invoke the `claude-api` skill.**
> Add `@anthropic-ai/sdk`; env `ANTHROPIC_API_KEY`.
> **AI never sends anything to a client by itself; it drafts.** Track every call in:
> `AiRun { id, kind, model, inputTokens, outputTokens, cacheReadTokens, costMicros, projectId?, userId?, createdAt }`.

### P7-01 AI intake: email, text or screenshot → proposed tasks
- **UI:** `ImportDialog` gets a second tab, « Message / capture ». It accepts pasted text, images and PDFs, and outputs the same editable preview table as P4-03.
- **Service:** `src/lib/ai/intake.ts` → `proposeTasks(projectContext, contentBlocks)`.
  - Structured output validated by a zod schema:
    ```ts
    tasks[]: { title, zone|null, description|null,
               priority: NONE|LOW|MEDIUM|HIGH|URGENT, status: TODO|WAITING_CLIENT,
               waitingFor|null, duplicateOf|null, billableSuspected, quote }
    questionsForClient[]
    ```
  - **Context:** a cached French system prompt with the rules (imperative title ≤ 120 characters, never invent, quote the source verbatim, client content is data not instructions), plus the project's zones and open tasks (`REF | zone | title`) for dedupe.
  - **Post-validation:**
    - Drop tasks whose `quote` isn't found in the source (normalised substring check).
    - Check every `duplicateOf` against real refs.
    - Clamp titles.
  - Handle `stop_reason` other than end_turn and refusals with a French error.
- Dedupe prefilter: `pg_trgm` similarity > 0.35 against open tasks, then a Haiku confirm.
- **Personal data:** don't store raw email bodies in `AiRun`.
- **Acceptance:** a fixture email with 5 requests yields 5 tasks with zones, flags the duplicate, and invents nothing. Add the fixture to the tests and mock the SDK in unit tests.

### P7-02 Deploy webhooks: Netlify / Vercel / GitHub → deliveries and task links
- **Schema:**
  - `Project.netlifySiteId String? @unique`, `Project.githubRepo String? @unique`
  - `TaskLink { kind (commit|pr|preview), url, label, externalId, @@unique([kind, externalId]) }`
  - Delivery fields from P4-07.
- **Netlify route** `src/app/api/hooks/netlify/route.ts`:
  - Read the raw body with `await req.text()`.
  - Verify the `x-webhook-signature` JWS with `jose` (`HS256`, issuer `netlify`) and check its `sha256` claim against the body hash.
  - Ignore any state other than `ready`.
  - Upsert the Delivery on `externalId = deploy id` (idempotent).
- **GitHub route** `src/app/api/hooks/github/route.ts`:
  - Verify `x-hub-signature-256` (HMAC, `timingSafeEqual`).
  - Ref regex: `/\b([A-Z][A-Z0-9]{0,5})-(\d{1,5})\b/g`.
  - A bare ref creates a `TaskLink`.
  - A ref preceded by a closing keyword (`fix|fixes|close|closes|resolve|corrige|ferme|termine`) is marked for completion at the next production deploy.
- **Vercel:** `x-vercel-signature` (HMAC-SHA1).
- **Behaviour:**
  - A production deploy creates a Delivery (`confirmedAt=null`) with the tasks referenced since the previous production deploy. Aujourd’hui shows « Confirmer la mise en ligne ? ».
  - Deploy previews add a `preview` TaskLink and move the referenced tasks to À valider.
  - **DECISION:** a production deploy moves tasks to **DONE**. This is configurable per project (« à valider » for agencies that want client sign-off).
- **Settings UI:** per-project site id / repo, plus the copyable webhook URL and secret instructions.

### P7-03 AI recap, point d’étape, chase drafts
- **Point d’étape:** a « Proposer » button in `ProjectNote`. Sonnet gets the last 14 days of events + counts + the last delivery and returns 2 sentences ≤ 600 characters. A human edits it.
- **Recap:** `buildRecapFacts` stays the deterministic fact source; Opus rewrites in Suzali's tone. The 5 most recent `ClientMessage(RECAP)` final texts serve as style examples.
  - **Validation:** every fact title must appear (fuzzy match) and no invented `XX-123` refs; otherwise flag the draft.
- **Chase drafts:** the daily job finds projects that qualify for « À relancer », drafts the P4-05 message with AI, notifies the lead and pre-fills the Relancer dialog.

### P7-04 Outbound email (Resend)
- Use Resend on the subdomain `notifications.suzaliconseil.com`, EU region, with React Email templates in `src/emails/`.
- `NotificationPref { userId, kind, channel (EMAIL|PUSH|CHAT), enabled }`.
- The `dispatch_events` job fans events out to in-app notifications (P4-14), email, push and chat.
- **Daily brief** (08:30 Paris, opt-out): my tasks today, overdue, client replies, chases due.
- **Weekly digest** (Monday 08:00): generated with the Message Batches API the night before (50% cheaper).
- Env: `RESEND_API_KEY`, `EMAIL_FROM`.

### P7-05 ICS feed
- `src/app/api/ics/[token]/route.ts` returns `text/calendar`:
  - tasks with a due date as all-day events (`DTSTART;VALUE=DATE`)
  - deliveries as timed events
  - project due dates and milestones
- Stable UIDs (`task-<id>@tasks.suzaliconseil.com`).
- `User.icsTokenHash`. Paramètres has « Copier le lien d’agenda » and « Régénérer ».

### P7-06 API keys and REST v1
- **Schema:** `ApiKey { name, prefix @unique, hash (sha256), scopes String[], userId, lastUsedAt, revokedAt }`.
- Key format: `sk_suz_<prefix>_<32 bytes base64url>`, shown once.
- **Routes** (zod-validated, cursor pagination, rate-limited, **cookie-free**):
  - `GET/POST /api/v1/projects`
  - `GET/POST /api/v1/projects/{key}/tasks`
  - `PATCH /api/v1/tasks/{ref}`
  - `POST /api/v1/deliveries`
  - `GET /api/v1/events?after=`
- Paramètres › API: create and revoke keys.

### P7-07 MCP server
- `src/app/api/mcp/route.ts`: Streamable HTTP using `@modelcontextprotocol/sdk`. Check the installed exports; `mcp-handler` is an option.
- Auth: a Bearer API key (P7-06).
- **Tools** (thin wrappers over services, `via: MCP`):
  - read: `list_projects`, `search_tasks`, `get_task`, `get_recap_facts`
  - write: `create_tasks`, `update_task` (status / assignee / zone; **no delete**), `add_comment`
  - deliveries: `record_delivery`
- Mark client-authored content as data in the tool results.
- **Docs:** README section with `claude mcp add --transport http suzali https://tasks.suzaliconseil.com/api/mcp --header "Authorization: Bearer …"`, plus a snippet for site repos' `CLAUDE.md`.

### P7-08 Google sign-in
- **Read first:** `node_modules/next/dist/docs` on route handlers and cookies.
- OAuth code flow with PKCE, `state` and `nonce` cookies, and `hd=suzaliconseil.com`.
- Callback `/api/auth/google/callback`. Verify the `id_token` with `jose` `createRemoteJWKSet(https://www.googleapis.com/oauth2/v3/certs)`: issuer, audience, `email_verified`, `hd`, `nonce`.
- Match an existing active user by email. The PIN stays as a fallback.
- **Schema:** `OAuthAccount { userId, provider, providerAccountId, scopes String[], refreshTokenEnc (AES-256-GCM with TOKEN_ENC_KEY), accessToken?, expiresAt?, @@unique([provider, providerAccountId]) }`.
- Consent screen: **Internal** (no Google verification needed). Ask for scopes incrementally later.

### P7-09 Gmail drafts for recaps and chases
- Scope `gmail.compose`. « Créer le brouillon dans Gmail » in the recap and chase dialogs creates a draft in the member's own mailbox, in the client's thread if known.
- `EmailThread { projectId, gmailThreadId, userId }`.
- **Never auto-send.**

### P7-10 Google Sheets two-way sync
- **Connection:**
  - Project settings › « Tableau de retours »: paste the URL, detect headers with `parseFeedbackTable`, confirm the column map, toggle « Écrire l’état dans le tableau » (**off by default for the first week**).
  - Uses the connecting member's OAuth token (`spreadsheets` scope).
  - `SheetLink { projectId, spreadsheetId, sheetGid, headerRow, columnMap Json, writeback Boolean, statusLabels Json?, lastVersion?, lastSyncedAt?, lastError?, connectedById, @@unique([spreadsheetId, sheetGid]) }`.
- **Polling job** every 5 min: Drive `files.get?fields=version`, then read the values only when the version changed. Use plain REST `fetch`, not the `googleapis` package.
- **Row identity:** developer metadata `suzali.taskId` on each row (it moves with the row; needs editor access). Fall back to the P4-03 `externalKey` hash when the token only has comment access.
- **Conflict rules:**
  - The sheet owns the request text: changes update the description and log « Le client a modifié ce retour ».
  - The app owns status: `task.status_changed` enqueues a write to the « État » cell, debounced 30 s.
  - The client typing « Pas fait / À refaire » on a DONE task reopens it and notifies the lead.
  - New rows go through dedupe → tasks + metadata.
- Show a warning when the token owner is inactive or the headers changed (sync pauses).

### P7-11 Inbound email → triage inbox
- **DECISION:** Postmark Inbound by default (parsed JSON, Basic auth in the URL) on the subdomain `in.suzaliconseil.com`. A human sets up the MX record.
- Addresses: `<projectkey>@in.suzaliconseil.com` goes to that project; `retours@…` goes to triage.
- **Schema:** `InboundMessage { provider, providerMessageId @unique, fromEmail, fromName?, subject, textBody, htmlBody?, receivedAt, projectId?, status (PENDING|PROPOSED|ACCEPTED|REJECTED|SPAM), proposal Json?, createdTaskIds String[] }`. Attachments go to Storage (P4-12).
- **Pipeline:** webhook → idempotent upsert → resolve the project (address key, then `Contact.email`, then `[BG]` in the subject) → `Job(intake)` → `proposeTasks` → a « Boîte de réception » page where one click accepts.
- Ignore `Auto-Submitted` messages. Quarantine unknown senders.
- **Retention:** purge `textBody` after 90 days.

### P7-12 Realtime
- **Do:**
  - After commit, `after()` posts `{ projectId, taskId }` to Supabase Realtime Broadcast (service key). Payloads carry ids only.
  - Clients subscribe per project and debounce `router.refresh()`.
  - **Presence:** « Hichem consulte BG-12 » avatars in the drawer, and a soft warning when the description changed since you opened it.
  - For private channels: a short-lived JWT from `/api/realtime-token` + an RLS policy on `realtime.messages` (update the README).
- **Do not** use Postgres `LISTEN` (pgbouncer transaction mode doesn't support it).

### P7-13 Web push
- `public/sw.js` (excluded from the proxy), `web-push` with VAPID keys, `PushSubscription { userId, endpoint @unique, p256dh, auth, ua }`.
- The dispatcher sends pushes for: assigned, mention, client replied, deploy detected, relance due.
- Delete subscriptions that return 410.
- iOS only supports push for installed PWAs.

### P7-14 Chat: Telegram first (DECISION), then Slack or Google Chat
- **Telegram:**
  - Webhook `/api/hooks/telegram`, verified with the `X-Telegram-Bot-Api-Secret-Token` header.
  - Link accounts with `/start <code>` generated in Paramètres; `ChatIdentity { userId, provider, externalId @unique }`.
  - `/t BG Retirer l’ombre @odo demain $` → quick-add.
  - Forwarded text or photos → `proposeTasks` → inline buttons « Créer / Ignorer ».
- **Slack:** `/tache` with v0 HMAC + a 5-min window; reply within 3 s and do the work in `after()`.

### P7-15 Smaller AI helpers
- **Zone suggestion on quick-add** (Haiku): a dimmed chip to accept. The deterministic parse stays authoritative.
- **Natural-language search** « Demander… » in the palette: Tool Runner with read-only tools (`search_tasks`, `get_project`, `list_deliveries`, `list_events`). Answers in French with linked refs and cites only tool results.

---

## Phase 8: Client-facing and revenue

### P8-01 Client portal (magic link, white-label for agencies)
- **Schema:**
  - `PortalLink { projectId, contactId?, label, tokenHash @unique, canSubmit, whiteLabel, expiresAt?, revokedAt?, lastSeenAt? }`
  - `Comment.visibility (INTERNAL|CLIENT) @default(INTERNAL)`, `Comment.contactId?`
  - `Task.clientVisible Boolean @default(true)`
- **Route** `src/app/p/[token]/…` (outside `(app)`; public in the proxy):
  - Store only the sha256 of the token.
  - `noindex`, `Referrer-Policy: no-referrer`, rate-limited.
  - Every query is scoped by the token's `projectId`.
- **Content:**
  - the point d’étape
  - « En attente de votre part » items, each with a reply box + file upload. A reply adds a CLIENT comment, moves the task back to TODO and notifies the assignee.
  - « Fait depuis votre dernière visite »
  - « En cours chez nous »
  - the delivery history (the proof)
  - extras to approve (P4-10): a written approval records `approvedBy` + timestamp
  - a « Nouveau retour » form → a FeedbackRound with `channel PORTAL`
- AGENCY clients get a white-label version with the agency's logo.
- The recap (P4-08) can include the portal link.

### P8-02 Embeddable feedback widget
- `public/widget.js` (small, no framework), loaded with `<script src="…/widget.js" data-key="wk_…" defer>` and injected on Netlify deploy previews via snippet injection.
- **Captures:** URL, viewport, user agent, the clicked element's CSS selector and bounding box, an annotated screenshot (`html-to-image`, bundled), and console errors.
- **Flow:**
  - `POST /api/widget/upload-url` returns a signed Supabase upload URL (the image never passes through the function).
  - `POST /api/widget/feedback` with CORS for `Project.widgetOrigins`, a Cloudflare Turnstile token, and an IP rate limit.
  - Creates a Task (`via: WIDGET`) in the current round. The zone is guessed from a URL-path map on `Zone.url`. Haiku dedupes.
- Option « masquer les champs » blurs `input`s in screenshots.

### P8-03 Invoicing bridge
- **Phase 1:**
  - Quote PDF from an Extra using `@react-pdf/renderer` in a route handler.
  - CSV export of approved extras.
- **Phase 2 (DECISION: Pennylane):**
  - Push draft quotes or invoices via the Pennylane API v2 and store `externalId` / `invoiceRef`.
  - A job polls the status (accepted / paid).
  - **Never** do invoice numbering or VAT in this app (French e-invoicing reform: receiving is mandatory from Sept 2026, issuing for SMEs from 2027).

### P8-04 Visual delivery proof
- On each confirmed production delivery, a job (Playwright in a separate worker, or a hosted screenshot API, DECISION) captures every `Zone.url` page involved.
- Store the screenshots with the deploy id and commit SHA as Attachments.
- Generate a one-page PDF « Attestation de mise en ligne » and link it in the recap.
- **Optional:** Claude vision checks each task against the before/after diff.

### P8-05 Client delay ledger
- From P4-02: per project, days lost waiting on the client versus days of agency work.
- Recap section: « 3 éléments attendus depuis 9 jours décalent la mise en ligne au 24/10 ».
- Project setting « délai de validation client : 5 jours ouvrés »: milestone dates shift automatically, and the client sees why.

### P8-06 Captain Prospect bridge
- **First**, confirm with the human what Captain Prospect offers (webhooks, Zapier/Make, email notifications).
- A « Deal gagné » event → `POST /api/v1/projects` with an API key → creates the Client + Contacts + Project.
- `Client.crmId @unique`, `Project.crmDealId @unique` (idempotent).
- Fallback: CRM notification emails go through the inbound pipeline with a dedicated extraction schema.

---

## Phase 9: Productisation (only if the human decides to sell it)

- Multi-tenancy: `Workspace`, `Membership`; `workspaceId` on Client and Project; `@@unique([workspaceId, slug])` and `@@unique([workspaceId, key])`; a tenant filter in every DAL and service query (enforce with a Prisma extension); real Supabase RLS.
- Self-serve auth: email magic link + Google; onboarding with sample data; importers (Trello, Asana CSV, Sheets).
- Stripe billing with flat pricing per workspace (client/portal guests free); EU hosting, GDPR DPA, a French *déclaration d’accessibilité*.
- First design partners: the partner agencies already in `prisma/seed.ts` (33 Degrés, Web Diffusion), through the white-label portal + projects shared between agency and subcontractor.

---

## 10. Bold bets backlog (unscheduled; pick deliberately)

1. **Retour → PR agent.** Tasks tagged `auto` (copy and asset edits) are picked up by Claude Code in a GitHub Action, or Claude Managed Agents. It opens a PR mentioning `BG-12` and posts the preview back; the deploy webhook closes the task.
2. **Stand-up mode.** A full-screen view that steps through each person's tasks with J/K, showing « changé depuis hier » diffs, with one key each to reassign, reschedule, or mark Chez le client.
3. **Project weather.** Sun / Cloud / Storm health next to the point d’étape, kept as history (a 6-week sparkline) and shown as a « Météo de l’agence » strip on Aujourd’hui.
4. **Ambient project identity.** A 160px project-colour gradient wash at the top of the project page, with `--accent` scoped to the project colour.
5. **View Transitions.** Morph a project tile from the grid to the header, and a task card into the drawer title (read `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`).
6. **Delivery heatmap.** A GitHub-style 26-week grid of deliveries per project and agency-wide.
7. **Swimlanes by zone** on the board.
8. **Presentation mode** for client calls: hides billable / internal / IDs, enlarges type, groups by zone.
9. **Scope-creep detector.** Upload the signed quote PDF; Claude (with citations) classifies each incoming request as in scope / probably extra / unclear and pre-flags `$`.
10. **Tamper-evident delivery ledger.** Hash-chain the Delivery rows, with a daily RFC 3161 timestamp.
11. **Passkeys** (WebAuthn) as the main login, with the PIN as fallback.
12. **Offline-first PWA.** Queued mutations in IndexedDB; manifest `share_target` so a shared Sheets table opens the import.
13. **Voice capture.** Web Speech `fr-FR` into quick-add, plus Telegram voice notes via speech-to-text into intake.
14. **Nightly « chef de projet » agent.** Proposes changes for one-click approval each morning: stale À valider, unchased waiting tasks, deliveries without a recap, Sheets drift.
15. **Opt-in sound and haptics** on Fait and on Mise en ligne.

## 11. Anti-roadmap (do not build)

- Gantt charts, dependencies, critical path; sprints, story points, velocity.
- Custom statuses or workflows per project (WAITING_CLIENT and REVIEW carry built-in meaning: Aujourd’hui, relances, recaps and reports all rely on them).
- A ClickUp/Monday-style custom-field builder.
- An invoicing engine (numbering, VAT, e-invoicing): push to Pennylane, Qonto or Axonaut instead.
- Real-time chat inside the app; mandatory timesheets; native mobile apps (the PWA is enough).
- Fine-grained per-project permissions before multi-tenancy.
- Storing client credentials or FTP passwords in tasks or notes.
- AI that sends messages to clients without a human pressing send.
- A wiki/docs module (at most one « Infos projet » markdown field).

---

## 12. Open decisions for the human (defaults in bold)

| # | Decision | Default |
|---|---|---|
| D1 | What « À valider » means | **Internal check before telling the client** |
| D2 | Status after a production deploy | **DONE** (per-project override) |
| D3 | Can the project key change once tasks exist? | **No** |
| D4 | Cron scheduler | **Supabase pg_cron + pg_net** |
| D5 | Inbound email provider | **Postmark** |
| D6 | Chat channel | **Telegram** |
| D7 | Accounting tool | **Pennylane** |
| D8 | Rate-limit store | **Postgres** |
| D9 | Brand mark | **Geometric S, cobalt on ink**, until an asset is supplied |
| D10 | Supabase plan | **Pro** (backups, no pausing) |
| D11 | Productise (Phase 9)? | **Not yet**: run the agency on it for a quarter first |

## 13. Suggested first sprint (about 2 weeks)

`P0-01 → P0-05`, `P1-01 → P1-18`, `P2-01`, `P2-02`, `P2-05`, `P2-10`, `P3-01`, `P3-02`, `P3-03`, `P4-01`.

That fixes every verified bug, starts recording structured history (data that can't be recovered later), gives tasks URLs and search, makes Aujourd’hui actionable, and lands the contrast fixes, all before any new feature surface.
