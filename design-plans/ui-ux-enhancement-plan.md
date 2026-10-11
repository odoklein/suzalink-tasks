# Suzali Tasks: UI/UX enhancement plan (whole app)

Date: 2026-10-10. Base commit: `b6c4f0c`.
Scope: every route (`/login`, `/`, `/projects`, `/projects/[slug]`, `/t/[ref]` and the drawer, `/clients`, `/facturation`, `/settings/*`) and the shared shell, primitives and tokens.

## How to read this plan

- **[source]** = verified by reading the code in this repo. **[docs]** = checked against `node_modules/next/dist/docs/` (Next 16.3, which `AGENTS.md` says differs from what most people know). **[hypothesis]** = plausible, but needs a browser, a device or a profile before anyone acts on it.
- Nothing here was rendered, profiled or run on a phone. Every number comes from source or from `node scripts/contrast.mjs`, which passes today (144 checks, 0 failures).
- This is not a restart. Phases 1 to 4 of `docs/PLAN.md` and the recent per-page passes (`d1a6386` to `b6c4f0c`) already produced a real design system. This plan lists what is **still missing**, and says what **not** to redo.

## 0. Where the interface stands

### What is already strong (keep it)

| Area | State [source] |
|---|---|
| Identity | Ink and cobalt on cool neutrals; status tones with meaning; the waiting-age chip as the signature. |
| Tokens | Neutrals, accent, six status tones each with solid / text / soft, five shadows, `--ring`, motion (`--dur-1…5`, `--ease-*`), layout (`--page-*`, `--sidebar-w`, `--drawer-w`), one z-index scale. `globals.css` is the single source. |
| Contrast | `scripts/contrast.mjs` gates text, status solids, control borders, focus ring and the removed `--st-*` tokens. `prefers-contrast: more` is handled. |
| Type scale | Eight named steps (`text-meta` … `text-hero`) with line heights; display face only from 22px up. |
| Motion | `animate-arrive`, `animate-landed`, `stamp-*`; reduced motion handled by targeted rules, not a blanket `0.01ms`. |
| Primitives | `ui/`: action-menu, badge, button (with `loading`), checkbox, chip, date-picker, empty-state, floating, input, kbd, section-header, segmented-control, skeleton, tabs, tooltip. Domain: Avatar, StatusIcon, DueChip, AgeChip, ProjectTile. |
| Touch | `pointer-coarse:` variants and a 44px hit-area pseudo-element on buttons. |
| Theme | Cookie-driven, rendered on the server, so no flash. |
| Tests | vitest + `vitest-axe` on primitives, palette, drawer, quick-add. |

### Verified gaps (this is the work)

| # | Gap | Evidence [source] |
|---|---|---|
| G1 | `Dialog` is a hand-built `div` with `role="dialog" aria-modal="true"`: no focus trap, the page behind is not `inert`, Tab can leave it. Each open dialog also adds its own `document` Escape listener, so stacked overlays can close together. Layout uses `vh` (`pt-[10vh]`, `max-h-[80vh]`), not `dvh`, and it is not a bottom sheet on phones. | `src/components/dialog.tsx:36-60` |
| G2 | Board drag uses `PointerSensor` only. No `TouchSensor`, no `touch-action`, no `accessibility` prop (no screen-reader instructions or announcements), and no non-drag way to change a card's column. The card wrapper is `role="button"` carrying the drag attributes. | `board.tsx:93-96`, `task-card.tsx:35`; grep for `Déplacer`, `announcements`, `TouchSensor` returns nothing |
| G3 | No app-level live region and no skip link (`id="main"` and "Aller au contenu" are absent). Sonner announces toasts, but a status change without a toast is silent. | grep across `src` |
| G4 | Navigation has almost no loading UI: one `loading.tsx` (`projects/[slug]`), zero `<Suspense>`, no `useLinkStatus`. The `(app)` layout awaits four loaders, and Today awaits ten queries in one `Promise.all` before any of its HTML is sent. | `(app)/layout.tsx:11`, `(app)/page.tsx:40-100` |
| G5 | No code splitting: zero `next/dynamic` / `React.lazy`. The layout statically imports the palette (cmdk), the 628-line drawer and three dialogs on every page; the project view imports all dialogs and dnd-kit even for `?vue=liste`. | `(app)/layout.tsx:1-8`, `project-view.tsx:15-21` |
| G6 | `AppContext` is one memoized object mixing data (user, team, projects, clients) with UI toggles (palette, new task, new project, nav, open task). Every toggle re-renders every consumer. | `app-context.tsx:96-124` |
| G7 | Switching project tabs calls `router.replace`, which re-runs the whole server render of the project page for what is already local state. | `project-view.tsx:191-194` |
| G8 | Text does not follow the user's font-size setting, while controls do. Type tokens are in `px` (`--text-ui: 13px`, `body { font-size: 14px }`), but Tailwind spacing and sizes (`h-8`, `size-7`) are `rem`. At a larger browser default, buttons grow around text that does not. | `globals.css:297-313,358` |
| G9 | The field style exists as copy-pasted class strings: `fieldClass` and `compactFieldClass` in `dialog.tsx`, again in `ui/input.tsx`, `ui/date-picker.tsx:165` and `select-menu.tsx:212`. Nine files import `fieldClass` from `dialog.tsx`, so the form primitive lives in the modal's file. | grep `fieldClass` |
| G10 | The dark theme is declared twice (system preference and `data-theme`), about 50 identical lines each, kept in sync by a script check. | `globals.css:121-225` |
| G11 | No manifest or PWA, although `lib/public-paths.ts` already whitelists `/manifest.webmanifest` and `/sw.js`. Only `icon.svg` and `apple-icon.png` exist. | `src/app`, `public-paths.ts` |
| G12 | No default to the Liste view on small screens: the project page opens on `tableau` whatever the width. | `projects/[slug]/page.tsx:92` |
| G13 | Today re-queries the team (`db.user.findMany`) although `getTeam()` is already cached and called by the layout. | `(app)/page.tsx:96`, `lib/dal.ts` |

Not verified (do not assume): filters and saved views, bulk actions, a keyboard-shortcut layer beyond `C` and `Ctrl K`, undo for task deletion. I found no multi-select code; check `docs/PLAN.md` P3-04 to P3-07 against the code before scheduling them.

---

## 1. Architecture overview

### 1.1 Component hierarchy and design-system structure

Keep the five layers, but make the boundaries real. Today the layers exist by convention only: the modal file exports the field styles and the primary/ghost buttons (`dialog.tsx:82-98`).

```
Tier 0  tokens         src/app/globals.css                 (only place with raw values)
Tier 1  primitives     src/components/ui/*                 generic, no domain knowledge
                         + move here: dialog, sheet, select-menu, pin-input, field
Tier 2  domain atoms   src/components/primitives.tsx       Avatar, StatusIcon, DueChip, AgeChip, ProjectTile
Tier 3  compositions   task-row, task-card, task-drawer, quick-add, command-palette …
Tier 4  views          project-view, board, today sections, billing-view …
```

Rules to enforce (ESLint `no-restricted-imports`, a few lines in `eslint.config.mjs`):
- Tier 1 imports nothing from Tiers 2 to 4.
- Raw hex or `rgb()` outside `globals.css`, `lib/color.ts` and `scripts/` is an error (a grep test, same style as the existing `--st-*` guard).
- `text-[Npx]` is an error except `pointer-coarse:text-[16px]` (the iOS zoom guard, already the only remaining use).

Add three missing primitives, each replacing code that exists today:

| Primitive | Replaces | Contract |
|---|---|---|
| `Field` | `labelClass` + `fieldClass` + hand-wired `aria-describedby` in nine files | `<Field label hint error>{(props) => <Input {...props} />}</Field>`; `props` carries `id`, `aria-describedby`, `aria-invalid`. Error renders with `role="alert"`. |
| `Dialog` / `Sheet` on native `<dialog>` | `dialog.tsx` (G1) | One component, bottom sheet under `sm`. Also used by the drawer (right-aligned) and the mobile nav. |
| `Announcer` | nothing (G3) | `announce(text)` writing to one `role="status"` region. |

A dev-only gallery (`src/app/(dev)/ui/page.tsx`, excluded from production by `notFound()` outside development) renders every primitive in light, dark, `prefers-contrast: more` and forced-colors. It costs no dependency and gives Playwright a stable target for screenshots.

### 1.2 State management and data flow

No new state library. The app has four kinds of state; each gets one home.

| Kind | Home | Rule |
|---|---|---|
| Server data | RSC props, Server Actions | Reads on the server. Writes return a typed result (`lib/action.ts`, already done). |
| URL state | Search params | `?tache=`, `?vue=` today; filters and sort belong here too, so views are linkable. |
| Ephemeral UI state | Split contexts | See below. |
| Optimistic state | `useOptimistic` | Status, assignee, due date, project status, drawer fields. Revert on error with a toast. |

**Split the context (G6).** Data rarely changes; UI toggles change constantly.

```tsx
// app-data-context.tsx: re-renders only when team/projects/clients change (after revalidation)
const AppDataContext = createContext<{ user: CurrentUser; team: TeamMember[]; projects: ProjectNavItem[]; clients: ClientOption[] } | null>(null);

// app-ui-context.tsx: a reducer, with a stable dispatch
type UiState = { palette: boolean; newTask: boolean; newProject: boolean; nav: boolean };
type UiAction = { type: "open" | "close"; panel: keyof UiState };
const UiStateContext = createContext<UiState>(null!);
const UiDispatchContext = createContext<React.Dispatch<UiAction>>(null!); // never changes

// task-url-context.tsx: openTask / closeTask / openTaskRef, the history logic now in app-context.tsx
```
Keep `useApp()` as a thin facade that merges the three, so call sites migrate one file at a time. Components that only call `setPaletteOpen` should read `UiDispatchContext` and stop re-rendering.

**Revalidation.** Twelve action files call `revalidatePath("/", "layout")`, which invalidates every route after every mutation [source]. That is fine while pages are dynamic. Do not switch to Cache Components yet: `next.config.ts` does not enable `cacheComponents` [docs], and it needs the Suspense boundaries from section 4 first. Order: Suspense (4.1), then evaluate `cacheComponents` per route.

### 1.3 Responsive and adaptive layout

Today there is one breakpoint that matters (`md`: sidebar fixed vs drawer). Define three tiers explicitly:

| Tier | Width | Sidebar | Project page | Drawer / dialogs |
|---|---|---|---|---|
| Mobile | < 768 | Drawer from a top bar (exists) | **Liste by default** (G12); board stays available | Full-screen drawer; dialogs as bottom sheets |
| Tablet | 768–1023 | **Icon rail** (about 56px) with labels in tooltips [hypothesis: check how much board width 248px leaves at 768] | Board, 2 to 3 columns visible, horizontal scroll with snap | Drawer over content, `--drawer-w` capped to `min(560px, 100vw - 56px)` |
| Desktop | ≥ 1024 | Full (`--sidebar-w`) | Full board | As today |

Rules:
- **Container queries over viewport queries** for anything that lives in a resizable pane. Today already uses `@container`; apply it to the week strip, Today's two-column layout and board column width.
- **Pointer and hover, not width, decide touch behaviour.** Keep `pointer-coarse:` for sizes; add `@media (hover: none)` so hover-only content (the project-note pencil, tooltips-as-labels) is always visible.
- **Dynamic viewport units everywhere**: `dvh`, never `vh` (G1). Add `viewport.viewportFit = "cover"` and safe-area padding on the mobile bar and sheets.
- Use `text-wrap: balance` (already on headings) and `min-w-0` + `truncate` on every flex child that holds user text (project and client names are user data).

---

## 2. UI enhancements

### 2.1 Visual hierarchy

**Typography: switch to rem (G8).** Rendering is identical at the default 16px, and text then follows the user's setting like the controls already do.

```css
@theme inline {
  --text-meta: 0.6875rem;  --text-meta--line-height: 0.875rem;   /* 11 / 14 */
  --text-xs:   0.75rem;    --text-xs--line-height:   1rem;       /* 12 / 16 */
  --text-ui:   0.8125rem;  --text-ui--line-height:   1.125rem;   /* 13 / 18 */
  --text-body: 0.875rem;   --text-body--line-height: 1.3125rem;  /* 14 / 21 */
  --text-title:1.0625rem;  --text-title--line-height:1.5rem;     /* 17 / 24 */
  --text-h2:   1.375rem;   --text-h2--line-height:   1.75rem;    /* 22 / 28 */
  --text-h1:   1.75rem;    --text-h1--line-height:   2.125rem;   /* 28 / 34 */
  --text-hero: 2.125rem;   --text-hero--line-height: 2.5rem;     /* 34 / 40 */
}
body { font-size: 0.875rem; }
```
Then check at 200% browser text size: the project header, the board card and the sidebar footer (email, truncated) are the three places most likely to break. `text-meta` at 11px should stay for non-essential information only (counts, key hints); never for the only copy of an instruction.

**Spacing: write down the allowed set.** The app uses Tailwind's 4px scale ad hoc. Allowed: `0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 12`. Page gutter is `px-4 sm:px-8` in every page container; make it one token so Wave-2 style drift (the `max-w-3xl px-6` leftovers fixed in the project page) cannot recur:
```css
@utility page-gutter { padding-inline: 1rem; @media (min-width: 40rem) { padding-inline: 2rem; } }
```

**Color tokens: collapse the duplicated dark block (G10).** `globals.css` already sets `color-scheme` per theme, so the CSS `light-dark()` function can hold both values on one line and remove ~50 duplicated lines:
```css
:root                    { color-scheme: light dark; }   /* follows the system */
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"]  { color-scheme: dark; }

:root {
  --bg:      light-dark(#f4f5f2, #101216);
  --surface: light-dark(#ffffff, #171a20);
  --ink:     light-dark(#16181d, #eceef1);
  --waiting-soft: light-dark(#fdf1d8, color-mix(in oklab, var(--waiting) 16%, var(--surface)));
}
```
Cost: `scripts/contrast.mjs` parses the two dark blocks and must learn `light-dark()` (it already has its own color-mix logic). Do this as one dedicated change; the diff to review is the contrast script's output, which must stay identical. Browser support is baseline (2024). Skip the change if the script rewrite looks bigger than a day.

Add only the tokens that are missing, not new colors:
- `--dialog-max-h: min(85dvh, 44rem)` and `--sheet-radius` (for G1).
- `--hit: 2.75rem` (44px) so `min-h-11` literals become `min-h-[var(--hit)]`.

### 2.2 Component refinements

| Component | Refinement |
|---|---|
| **Button** | Keep. `active:scale-[.98]` is on every variant; check it does not read as a wobble on the ink-filled primary in dark mode [hypothesis]. Icon-only buttons: keep the 28px desktop size (WCAG 2.5.8 needs 24px) and the 44px coarse hit area. |
| **Forms** | One `Field` (1.1). Errors inline under the field, plus the first invalid field focused on submit. Disabled submit is avoided: let the user submit and explain, because a disabled button cannot say why. Long forms (import, delivery) warn before a backdrop click discards text. [hypothesis: confirm none of them already guards] |
| **Cards** | `TaskCard` becomes a real `<button>` (opens the task) plus a separate drag handle via `setActivatorNodeRef`, as `docs/PLAN.md` P5-03 describes. One focusable element per card. |
| **Navigation** | Sidebar lists every live project in one scroll. At about 20+ projects that is slow to scan: add "Récents" (the repo already has `lib/last-project.ts`) above the list, and let the palette be the answer for the rest. Add `useLinkStatus` (see 3.3) for a pending dot on links. |
| **Modals** | Native `<dialog>` (below). Bottom sheet under `sm` with a grab handle and sticky footer. Exit animation. Nested confirm dialogs must close only the top one. |
| **Menus** | `select-menu.tsx` (252 lines): check it against the APG select-only combobox pattern (Home/End, typeahead, Tab closes, no focusable hidden input). `docs/PLAN.md` P5-02 lists it; I did not verify how much is done, so read it before rewriting. |
| **Tables and lists** | `TaskRow` gets an sr-only status label and a visible status trigger of at least 44px on coarse pointers. |

Native dialog, minimal shape (keeps the existing `title`, `footer`, `wide` props):

```tsx
const ref = useRef<HTMLDialogElement>(null);
useEffect(() => {
  const d = ref.current;
  if (!d) return;
  if (open && !d.open) d.showModal();      // top layer, inert background, focus trap, focus restore
  if (!open && d.open) d.close();
}, [open]);

<dialog
  ref={ref}
  aria-labelledby={titleId}
  onCancel={(e) => { e.preventDefault(); onClose(); }}   // Escape: only the top-most dialog gets it
  onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
  className="m-auto w-full max-w-lg rounded-lg border border-line bg-surface p-0 shadow-overlay
             backdrop:bg-[var(--scrim)] max-sm:mb-0 max-sm:max-h-[90dvh] max-sm:rounded-b-none"
>
```
Optional exit animation without a timer (`@starting-style`, Chrome 117, Safari 17.4, Firefox 129; where unsupported there is simply no exit animation):
```css
dialog { transition: opacity var(--dur-2) var(--ease-out), transform var(--dur-2) var(--ease-out),
                     overlay var(--dur-2) allow-discrete, display var(--dur-2) allow-discrete; }
dialog:not([open]) { opacity: 0; transform: translateY(6px) scale(.98); }
@starting-style { dialog[open] { opacity: 0; transform: translateY(6px) scale(.98); } }
@media (prefers-reduced-motion: reduce) { dialog { transform: none; } }
```
Risk: `happy-dom` (the test environment) may not implement `showModal`. Existing `*.dom.test.tsx` files that open dialogs need a small polyfill in `vitest.config.ts` setup. Do this first, in its own commit.

### 2.3 Micro-interactions and motion

The motion system is the most finished part of the app. Remaining items only:

| Item | Detail |
|---|---|
| Dialog exit | Above. Today `if (!open) return null` removes it instantly. |
| Pending dot on sidebar links | `useLinkStatus` (3.3), `animate-fade-in` with a 150ms delay so fast navigations show nothing. |
| Optimistic confirmation | Status, assignee and due-date changes use the existing `animate-arrive` wash on the row, never a toast, for routine edits. |
| Button loading | Already built into `Button`; make sure every Server Action submit uses `loading` rather than `disabled`. |
| Skeletons | `.skeleton` shimmer exists. Rule: at most five shimmering blocks per screen, and a skeleton only after 150ms. |
| Focus | One ring for everything (`--ring`); inputs pair it with `border-accent`. Nothing to add. |

Do not add (already evaluated and rejected in `project-page-enhancement-plan.md`): View Transitions, FLIP helpers, tab crossfades, popover origin tweaks. The earlier plan found that `react@19.2.8` does not export `ViewTransition` here; I did not re-check.

---

## 3. UX enhancements

### 3.1 Flows and friction points

The product's core flows are in `README.md`: paste feedback in, chase the client, record a delivery, send a recap, run Today. Friction found in code:

| Flow | Friction | Fix | Evidence |
|---|---|---|---|
| Move a task on a phone | Drag may not start on touch (no `TouchSensor`), and there is no alternative. | `MouseSensor` + `TouchSensor` + `KeyboardSensor`, plus a "Déplacer vers…" menu on each card (visible on focus and hover, always on coarse pointers). | G2 |
| Open a project on a phone | Opens on the board, the hardest view on a small screen. | Default to Liste under 768px (read the width on the server via a `viewport` hint cookie, or accept a client-side switch on first mount). | G12 |
| Switch project tabs | Each click runs a server render. | `window.history.replaceState` (Next syncs it with `useSearchParams`) [docs: check `link.md`/`use-search-params.md` before relying on this]. | G7 |
| Open any page | Blank or stale until all queries return. | Route-level `loading.tsx` and Suspense (4.1). | G4 |
| Dismiss a long form | A backdrop click closes the import and delivery dialogs. | Dirty-form guard: confirm only when the form has input, otherwise close. | G1 |
| Find a project in the sidebar | Single long list. | "Récents" group; palette for the rest. | 2.2 |
| Today | One heavy render; the user waits for team load and recent deliveries before seeing "Mes tâches". | Stream sections by priority (4.1). | G4, G13 |

**Measure before the next round.** Add `useReportWebVitals` (Next) writing to the existing `lib/metrics.ts` / Sentry, and watch INP on `/projects/[slug]` and the drawer. Also sit with two teammates doing a real chase-and-recap, and write down every hesitation. Ten minutes of that will reorder this list better than the list itself.

### 3.2 Accessibility (WCAG 2.2 AA, a superset of 2.1 AA)

The repo targets 2.2 in `docs/PLAN.md`. 2.2 adds 2.5.7 Dragging Movements (relevant to the board) and 2.5.8 Target Size. Status by criterion:

| Criterion | Status | Action |
|---|---|---|
| 1.4.3, 1.4.11 contrast, non-text | Pass, scripted | Keep `contrast.mjs` in CI. |
| 1.4.4 resize text, 1.4.12 text spacing | Partial | rem type scale (2.1), then test at 200% and with the text-spacing bookmarklet. |
| 1.4.10 reflow (320px) | Unknown | Playwright check: no horizontal scroll at 320px on every route, except the board's own scroller. |
| 2.1.1 keyboard, 2.1.2 no trap | **Fail for dialogs** | Native `<dialog>` (G1). Board keyboard sensor exists; add announcements. |
| 2.4.1 bypass blocks | **Fail** | Skip link. |
| 2.4.3 focus order, 2.4.7 focus visible | Pass (global `:focus-visible`) | Dialog focus restore comes free with `showModal()`. |
| 2.5.7 dragging alternative | **Fail** | "Déplacer vers…" menu. |
| 2.5.8 target size | Pass | 28px desktop icon buttons (min 24), 44px hit area on coarse. |
| 3.3.1, 3.3.3 errors | Mostly pass (about 21 `role="alert"`/`aria-live` sites) | `Field` makes it uniform. |
| 4.1.3 status messages | Partial | `Announcer` for non-toast changes. |

Concrete pieces:

```tsx
// (app)/layout.tsx
<a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-toast
   focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-ui focus:shadow-pop">Aller au contenu</a>
…
<main id="main" tabIndex={-1} className="…">
```

```tsx
// board.tsx: French announcements; uses the column label, not the status enum
<DndContext
  sensors={sensors}
  accessibility={{
    screenReaderInstructions: {
      draggable: "Appuyez sur Espace pour saisir la tâche, sur les flèches pour la déplacer, sur Espace pour la déposer, sur Échap pour annuler.",
    },
    announcements: {
      onDragStart: ({ active }) => `Tâche ${refOf(active.id)} saisie.`,
      onDragOver:  ({ active, over }) => over && `${refOf(active.id)} au-dessus de ${labelOf(over.id)}.`,
      onDragEnd:   ({ active, over }) => over ? `${refOf(active.id)} déplacée dans ${labelOf(over.id)}.` : `${refOf(active.id)} remise à sa place.`,
      onDragCancel:({ active }) => `Déplacement de ${refOf(active.id)} annulé.`,
    },
  }}
>
```
Sensors (a touch drag cannot share a sensor with scrolling, so split mouse and touch):
```tsx
useSensor(MouseSensor,    { activationConstraint: { distance: 6 } }),
useSensor(TouchSensor,    { activationConstraint: { delay: 220, tolerance: 6 } }),
useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
```
and `touch-action: manipulation` on cards.

Verification that code cannot give: NVDA with Firefox (the team is on Windows) and VoiceOver on iOS for the board, drawer and dialogs. Add `@axe-core/playwright` runs for every route plus the open drawer and dialog, in light and dark (`docs/PLAN.md` P5-15 specifies this).

### 3.3 Errors, empty states, feedback

Make one ladder and use the lowest rung that works. Today there are 69 `toast` call sites [source], and feedback style is a per-file decision.

| Rung | Use for | Mechanism |
|---|---|---|
| 1. Inline field | Validation | `Field` error, `role="alert"`, field focused |
| 2. Inline section | A save or load that failed inside a panel | A banner in the panel with a retry button, `role="alert"` |
| 3. Toast | Success that has an **Annuler**, and background results | `sonner`, polite; success 5s with undo; errors do not auto-dismiss |
| 4. Page | Whole route failed or missing | `error.tsx`, `not-found.tsx`, `global-error.tsx` (all exist on primitives) |

Rules:
- Routine edits (status, assignee, date) confirm with the row wash, not a toast. Toasts for every change teach people to ignore them.
- Every destructive action offers **Annuler** for 5 to 8 seconds instead of a confirm dialog (deliveries already do this).
- Empty states say what the screen is for and offer one next action, and distinguish "nothing yet" from "nothing matches this filter". `ui/empty-state.tsx` exists; audit its call sites for both cases.
- Offline: if the PWA ships (4.4), a one-line banner "Hors ligne : les modifications ne sont pas enregistrées" beats silent failure. Do not queue writes offline.

Loading feedback that is missing:
```tsx
// sidebar link: a dot appears only if navigation is slow [docs: use-link-status.md]
function PendingDot() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={cn("ml-auto size-1.5 rounded-full bg-accent opacity-0 transition-opacity delay-150", pending && "opacity-100 animate-pulse")} />;
}
```
The docs say to prefer `loading.js` and prefetching, and use `useLinkStatus` as the secondary cue; do both.

---

## 4. Technical recommendations

### 4.1 Performance

| Item | Detail |
|---|---|
| Loading boundaries | Add `(app)/loading.tsx`, `projects/loading.tsx`, `settings/loading.tsx` next to the existing project one [docs: `loading.md`, read first]. Without a `loading.js`, dynamic routes are not prefetched. |
| Stream Today | Keep `getCurrentUser()` and the header at the top, then wrap each section in `<Suspense>` with its own small async component: "Mes tâches" first; "Chez le client", "À attribuer", "Charge de l'équipe" and "Mises en ligne" after. Reuse `getTeam()` (G13). |
| Code splitting | `next/dynamic` for the palette, drawer, new-task, new-project, import, recap and delivery dialogs, and `Board`. **Caveat [docs]:** a Server Component that dynamically imports a Client Component does not get automatic splitting, so do it in a `"use client"` wrapper, not in `(app)/layout.tsx`. |
| Palette | Mount it on first open. The `Ctrl K` listener stays in the wrapper (10 lines), so the first keypress is not lost while the chunk loads. |
| Project page | Load DONE tasks of the last 14 days plus a count (`docs/PLAN.md` P5-10); lazy-load `Board` only when the tab is `tableau`. |
| Long boards | Try `content-visibility: auto; contain-intrinsic-size: auto 72px` on cards. Zero dependency, but check it against dnd-kit measuring before keeping it [hypothesis]. |
| Fonts | Three families through `next/font`. Check which axes of Bricolage Grotesque (`opsz`, `wdth`) are actually used; every unused axis is shipped bytes. [hypothesis] |
| Query | `Task @@index([status, statusChangedAt])` for Today's waiting list, only if `EXPLAIN` shows a sort on a large set. Existing indexes: `[status]`, `[assigneeId, status]`, `[projectId, status, position]`. |
| Budget | Use the budgets from `docs/PLAN.md` P5-11 (`/projects/[slug]` ≤ 600 KB first-load JS, `/clients` ≤ 520 KB) and fail CI above them. Take a before number first; the plan's "today" figures date from an older build. |

### 4.2 Libraries and tools

Add little. The stack already covers state, forms, dnd, palette, toasts and dates.

| Add | Why | Instead of |
|---|---|---|
| `@playwright/test` + `@axe-core/playwright` | Real-browser a11y, keyboard, touch, dark mode, 320px reflow, bundle budget | Relying on `happy-dom`, which cannot test layout, `showModal` fidelity or touch |
| `useReportWebVitals` (built into Next) | INP and LCP per route into the existing metrics | A third-party RUM service |
| The dev gallery (1.1) | Visual regression target, review surface for primitives | Storybook (heavy for 15 primitives; revisit past ~40) |

Do not add: a global state library, a CSS-in-JS library, a headless-UI library (`<dialog>` and `popover` cover modals; `ui/floating.tsx` already positions menus), or an icon pack besides lucide.

### 4.3 PWA (small, optional)

`src/app/manifest.ts` [docs: `manifest.md`], with the paths already public:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Suzali Tasks",
    short_name: "Suzali",
    lang: "fr",
    display: "standalone",
    start_url: "/",
    background_color: "#f4f5f2",
    theme_color: "#f4f5f2",
    shortcuts: [
      { name: "Nouvelle tâche", url: "/?nouvelle=1" },   // needs a tiny handler: today "C" opens it
      { name: "Aujourd’hui", url: "/" },
    ],
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  };
}
```
**Blocked on an asset:** `docs/PLAN.md` P2-09 made the favicon a placeholder pending a brand asset, and 192 and 512 PNGs do not exist. Do not generate a fake logo. Ask for the brand file first. No service worker is needed for an installable shell.

### 4.4 Theming and scalability

- Three token layers: **primitive** (`--accent`, raw values) → **semantic** (`--waiting-soft`, `--control`) → **component** (only where a component needs a local override). Today the first two exist; keep the third rare.
- If a client-facing portal happens (`docs/PLAN.md` Phase 8), scope brand overrides to `[data-brand="…"]` and override only the accent family. The status tones keep their meaning, and the contrast script runs once per brand.
- One copy source: the French strings stay in components plus `lib/fr.ts`, governed by the glossary (`docs/PLAN.md` §0.4). Add a **copy lint** test with an allowlist for straight apostrophes in JSX text and for a missing narrow no-break space before `: ; ! ?`. Do not extract to an i18n library until a second language is a real requirement.
- Dark mode: keep two sources of truth only until `light-dark()` lands (2.1), then one.

---

## 5. Prioritized roadmap

Effort: **S** ≤ half a day, **M** 1–2 days, **L** 3–5 days. Impact: user value or risk removed. "R" = needs a rendered or device check.

### Wave A: accessibility blockers and quick wins (about 4 days)

| ID | Item | Effort | Impact | Notes |
|---|---|---|---|---|
| A1 | Skip link + `id="main"` | S | High a11y | 2.4.1. No risk. |
| A2 | `Announcer` + wire into board, status, save, undo | M | High a11y | 4.1.3. |
| A3 | Board: Mouse + Touch + Keyboard sensors, `touch-action`, French announcements | M | High (mobile, a11y) | G2. **R** on a real phone. |
| A4 | "Déplacer vers…" menu on cards | M | High a11y (2.5.7), High mobile | Reuses `ActionMenu`. |
| A5 | Liste by default under 768px | S | Medium | G12. |
| A6 | Tabs via `history.replaceState` | S | Medium perf | G7. Check `page.tsx` loads all tab data up front. |
| A7 | Reuse `getTeam()` in Today | S | Low | G13. |
| A8 | `(app)`, `projects`, `settings` `loading.tsx` + `useLinkStatus` dot | S | High perceived speed | Read `loading.md` first. **R** |

### Wave B: foundations (about 7 days)

| ID | Item | Effort | Impact | Notes |
|---|---|---|---|---|
| B1 | happy-dom `showModal` polyfill in test setup | S | Unblocks B2 | Own commit. |
| B2 | Native `<dialog>` + sheet; migrate all callers; drawer and mobile nav on the same base | L | High a11y | G1. **R** at 3 widths. |
| B3 | `Field` primitive; move field classes out of `dialog.tsx`; migrate files | M | Medium consistency | G9. |
| B4 | rem type scale | S–M | Medium a11y | G8. **R** at 200% text. |
| B5 | Split `AppContext` | M | Medium perf | G6. Facade first, then migrate. |
| B6 | Dirty-form guard on import, delivery, recap | S | Medium (data loss) | Verify first. |

### Wave C: performance and delivery (about 6 days)

| ID | Item | Effort | Impact | Notes |
|---|---|---|---|---|
| C1 | Stream Today with Suspense | M | High perceived speed | G4. |
| C2 | `next/dynamic` via a client wrapper: palette, drawer, dialogs, Board | M | Medium (bundle) | G5. Measure before and after. |
| C3 | Playwright + axe in CI (routes, drawer, dialog, light/dark, 320px) | L | High (keeps A and B fixed) | `docs/PLAN.md` P5-15. |
| C4 | `useReportWebVitals` into metrics | S | Medium (tells you what to do next) | |
| C5 | Bundle budget check in CI | S | Medium | After a baseline number. |

### Wave D: polish and structure (about 5 days, parallelizable)

| ID | Item | Effort | Impact | Notes |
|---|---|---|---|---|
| D1 | Tokens via `light-dark()`; update `contrast.mjs` | M | Medium (maintainability) | G10. Output must stay identical. |
| D2 | Tablet icon-rail sidebar | M | Medium | **R**: confirm the problem exists first. |
| D3 | "Récents" in the sidebar | S | Low–Medium | |
| D4 | Dev gallery route + Playwright screenshots | M | Medium | |
| D5 | Lint boundaries (tier imports, raw colors, `text-[Npx]`) | S | Medium (prevents drift) | |
| D6 | Copy lint test | S | Low–Medium | Allowlist needed. |
| D7 | `TaskCard` as button + drag handle | M | Medium a11y | `docs/PLAN.md` P5-03. |

### Wave E: long term (product decisions, not design debt)

| ID | Item | Effort | Impact |
|---|---|---|---|
| E1 | Drawer as an intercepting route (`@drawer/(.)t/[ref]`) with server reads | L | Medium–High (removes hand-rolled history code in `app-context.tsx`) |
| E2 | Cache Components, route by route, then `updateTag` replaces `revalidatePath("/", "layout")` | L | High perf, High risk. Only after A8, C1 and E1. |
| E3 | PWA manifest | S, blocked on a brand asset | Low–Medium |
| E4 | Filters and saved views in the URL, bulk actions, keyboard layer | L each | High, but first confirm what already exists (see "Not verified") |
| E5 | Brand-scoped tokens for a client portal | M | Only if Phase 8 is approved |

### Sequencing and guardrails

1. A before B before C. B2 depends on B1. C3 should land before D so later changes cannot regress.
2. After each change run `npm run check` and `node scripts/contrast.mjs` (see `package.json`). After editing UI files, run Rams `quick_review` with `via: "rules"` on them and fix what it flags (project owner's standing rule).
3. Tailwind v4 and Next 16.3 differ from older versions. Read the matching guide in `node_modules/next/dist/docs/` before touching `loading`, `dynamic`, `manifest`, `useLinkStatus` or Cache Components.
4. The repo mixes CRLF and LF line endings. Preserve each file's endings.
5. Do not touch the decisions in `project-page-enhancement-plan.md` (status solids, `--control`, `--ring`, oklab mixes, `arrive`/`landed`/`stamp-*`).
6. Every **R** item needs a screenshot or a device check before it is called done. Nothing in this plan has had one.

### If only five things get done

1. **B2** native dialog: the one place where a keyboard user can be locked out of the page.
2. **A3 + A4** board on touch with a non-drag alternative: phone use is unusable or unproven today.
3. **A8 + C1** loading boundaries and streamed Today: the most visible speed gain.
4. **A1 + A2** skip link and announcer: small, and they close WCAG gaps.
5. **C3** Playwright with axe: keeps all of the above from decaying.
