# Project page: consolidated enhancement plan

Surface: `/projects/[slug]` (`project-view.tsx` and everything it renders).
Base commit: `8cde708a861977e920c1a1c29a52708d73fb0b15`.
Date: 2026-10-10.
Status: **implemented in the working tree on 2026-10-10, not committed.** Waves 0–4 are applied; Wave 5 (the Apple-HIG audit) is still to run. Verification done: `npm run typecheck`, `npm run lint` (one pre-existing warning in an untracked script), `npm test` (364 pass + 6 new `useArrivals` tests), `node scripts/contrast.mjs` (144 checks, 0 failures) and `next build`. Nothing was looked at in a browser: every **[rendered check]** item below is still open.

## Where this comes from

Four read-only audits were launched on this surface. Three finished and one was stopped.

| Audit | Result |
|---|---|
| Design-contract conformance (improve-ui) | finished: 3 findings (A1–A3) |
| Color strategy and contrast | finished: 10 findings (C1–C10) |
| Motion | finished: 9 findings plus a thesis (M1–M9) |
| Apple HIG review (accessibility, interaction, writing, craft) | **stopped before it produced anything.** Nothing here is based on it. The gap is covered in Wave 5. |

Nothing was rendered or profiled. Every number below comes from reading source or computing from token values. Items tagged **[rendered check]** must be looked at in a browser before they merge. The few items I re-checked myself are tagged **[re-checked]**.

## Ground rules (from the repo, and binding)

1. This is Next.js 16.3 with breaking changes. Before touching a Next API (`loading.tsx` etc.), read the matching guide in `node_modules/next/dist/docs/`.
2. All UI copy is French. Follow the glossary in `docs/PLAN.md` §0.4 and French typography (narrow no-break space before `: ; ! ? %`, `’` apostrophe).
3. Use existing tokens and primitives. Do not invent values the repo already has a token for.
4. One task, one commit. After each: `npm run typecheck`, `npm run lint`, `npm test`.
5. `globals.css` is touched by Waves 1, 2 and 3. Do those tasks in the order given. After any color change, run `node scripts/contrast.mjs` and update the result comment in the `globals.css` header. The dark theme is declared twice (`prefers-color-scheme` block and `[data-theme="dark"]` block), and both blocks must stay identical.
6. Do not run `db push` or touch production data. None of this plan needs the database.

## Strategy in one paragraph

The identity stays: ink and cobalt on cool neutrals, with status tones that carry meaning, and the waiting-on-client age chip as the product's signature. The audits found no reason to change that. They found three kinds of defect: (1) leftovers from Phase 2 that now render blank, (2) color and focus roles that stop holding in dark mode and for color-blind users, and (3) motion that stops at "something appeared" instead of showing where a task went. "Pushing further" means fixing those and then spending boldness in exactly two places: a task visibly landing where it was sent, and the delivery being stamped into the timeline.

---

## Wave 0: Broken now (do first)

### W0-1. Replace removed `--st-*` tokens [A1 + C1, High, re-checked]

Phase 2 deleted `--st-*` and `--color-st-*` (commit `774ff43`). Eight call sites still use them, so the utility classes generate nothing and `var(--st-*)` is invalid (transparent fill, inherited text color).

| File:line | Now | Change to |
|---|---|---|
| `src/components/rounds-view.tsx:112` | `var(--st-done)` | `var(--done)` |
| `src/components/rounds-view.tsx:113` | `var(--st-waiting)` | `var(--waiting)` |
| `src/components/chase-dialog.tsx:41` | `text-st-waiting hover:bg-[color-mix(in_srgb,var(--st-waiting)_14%,transparent)]` | `text-waiting-text hover:bg-waiting-soft` |
| `src/components/import-dialog.tsx:287` | `bg-[color-mix(...var(--st-done)...)] text-st-done` | `bg-done-soft text-done-text` |
| `src/components/import-dialog.tsx:288` | `bg-[color-mix(...var(--st-waiting)...)] text-st-waiting` | `bg-waiting-soft text-waiting-text` |
| `src/components/copy-email-button.tsx:29` | `text-st-done` | `text-done-text` |
| `src/app/(app)/settings/journal/page.tsx:37` | `text-st-done` | `text-done-text` |
| `src/app/(app)/settings/integrations/page.tsx:38` | `border-st-waiting/40` | `border-waiting/40` |

The last two are outside the project page but are the same bug.

- **Acceptance:** `grep -rnE "\-\-st-|st-(done|waiting|todo|progress|review)\b" src` returns nothing. In the Retours tab the progress bar shows green and amber segments. The header "Relancer" button is amber.
- **Guard:** add that grep as a test (or a line in `scripts/contrast.mjs`) so it cannot come back.
- **[rendered check]:** the repo's `.next` build is from 7 Oct and still contains the old tokens, so a stale dev build can hide this. Verify on a fresh build.

---

## Wave 1: Color, contrast and focus foundations

Order matters: W1-1 before W1-2.

### W1-1. Mix in oklab instead of oklch [C2, High]

`color-mix(in oklch, tone 16%, surface)` interpolates hue along the shorter arc from the tone to the dark surface (hue 264, chroma .013). In dark mode this turns amber, orange and red soft backgrounds violet-grey and green into blue. Member avatars collapse toward blue-violet. `scripts/contrast.mjs:70-85` reimplements the same hue logic, so its checks pass anyway.

Change:
- `src/app/globals.css`: every `color-mix(in oklch, …)` in both dark blocks (lines about 121–146 and 172–197) becomes `in oklab`.
- `src/lib/color.ts:9,13` (`softColor`, `strongColor`): `in oklab`; `strongColor` uses a 64% color share (was 70%).
- `scripts/contrast.mjs`: replace `mixOklch` (lines about 70–85) with an oklab mix (linear interpolation of L, a, b), and accept `in oklab` in the regex at about line 96.
- **Acceptance:** `node scripts/contrast.mjs` passes. Computed dark soft backgrounds are warm for waiting, soon and danger (expected about `#352f28`, `#372d2a`, `#38292c`) and teal-green for done (`#20322f`). Light theme is visually unchanged (white is a powerless hue, so oklab equals oklch). Worst avatar-initial contrast is at least 4.5:1 in both themes (audit: 4.72 dark, 5.09 light).
- **[rendered check]:** dark board with a waiting column, and the avatar stack.

### W1-2. Status icon solids reach 3:1 in light [C3, High]

Light solids on the board column backgrounds are below 3:1: waiting 2.12–2.53, todo 2.72–3.25, done 2.84–3.40. They carry the status icon (1.6/16 stroke), the sidebar waiting dot and the collapsed Done rail. Dark is fine.

Change, light theme only, in `globals.css`: `--waiting #da950b → #bb7700`, `--todo #8a8f98 → #81868f`, `--done #169f65 → #03995f`.
- Expected: at least 3.65:1 on surface, at least 3.06:1 on sunken, at least 3.29:1 on the waiting column.
- Also: in `scripts/contrast.mjs:137-139` make these solid-on-ground checks gating (3:1 on surface, sunken and the waiting column), not informational.
- **Deviation to record:** `docs/PLAN.md` P2-01 specified `#da950b`. Note the change in the commit body and update the PLAN line.
- **[rendered check]:** the amber must still read as amber next to the orange "soon" chip.

### W1-3. Focus ring that works on accent fills [C4, High]

`--ring` is `0 0 0 1px accent, 0 0 0 4px accent-soft`. On accent-filled controls (dark-mode primary button, checked checkbox, switch on) the 1px line disappears and the halo is 1.16:1 (light) and 1.25:1 (dark).

Change `globals.css:75`: `--ring: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent);` (5.52:1 light, 6.40:1 dark against the surface; same geometry as the global `:focus-visible` rule).
- **[rendered check]:** inputs pair the ring with `border-accent`; confirm they still look right.

### W1-4. Placeholder text at 4.5:1 [C7, Medium]

`placeholder:text-faint` is 2.96:1 on `surface-2` (light) and holds real instructions (the quick-add hint `@odo !haute #homepage demain $` in `task-list.tsx:121`). Replace with `placeholder:text-muted` (5.23:1 light, 6.29:1 dark) at: `dialog.tsx:69`, `ui/input.tsx:10`, `quick-add.tsx:141`, `task-drawer.tsx:542`, `select-menu.tsx:212`, `command-palette.tsx:161`, `ui/date-picker.tsx:165` (and the empty-value text at `:86`). [re-checked: 7 occurrences exist.]
- Also fix the `P2-04` wording so `faint` is for icons and disabled states only.

### W1-5. Control boundaries get a `--control` token [C8, Medium]

Unchecked checkbox border and switch-off track are `line-strong`, 1.53:1; field borders are `line` on `surface-2`, 1.22:1. Add `--control` (light `#888c94`, dark `var(--faint)`) plus `--color-control` in `@theme inline`, and use it at `ui/checkbox.tsx:20` (border), `ui/checkbox.tsx:40` (off track), `ui/input.tsx:10`, `dialog.tsx:69`, `ui/date-picker.tsx:165`. Keep `--line` for cards and dividers.
- **[rendered check]:** inputs may look heavier. If so, apply `--control` only to checkbox and switch, and leave field borders alone.

### W1-6. Overdue due chips need a non-hue cue [C5, Medium]

`DueChip` (`primitives.tsx:193-219`) shows overdue and "soon" with the same icon, and `danger-text` vs `soon-text` is nearly indistinguishable under deuteranopia (ΔE_OK .015). Change `primitives.tsx:205-207`: overdue renders as `variant="solid"` and gets `aria-label={"En retard : " + formatDue(date)}`. Overdue is rare, so it earns the strongest treatment, like `AgeChip` at 5 days or more.

### W1-7. Avenant statuses carry meaning [C6, Medium, re-checked]

`extras-view.tsx:169` renders six states (brouillon, devis envoyé, approuvé, refusé, facturé, payé) as one grey pill. Replace with `Badge` tones: draft neutral, quoted waiting, approved accent, invoiced waiting, paid done, rejected danger. Keep the label text.

### W1-8. Small color items [C9, C10, Low]

- Drop-target ring `ring-accent/40 → ring-accent/80` at `board.tsx:246,264` [re-checked] (3.35:1 light).
- Active row in `select-menu.tsx:232`: add an inset 2px accent bar.
- `::selection` (`globals.css:333-335`): introduce `--selection` (light 28% accent in surface, dark 32%) so it is visible.
- `quick-add.tsx:21`: HIGH priority token uses neutral, not `soon` (orange already means "due today or tomorrow").

---

## Wave 2: Consistency with the documented system

### W2-1. Containers [A2, Medium, re-checked]
`rounds-view.tsx:45,62` and `extras-view.tsx:65` use `max-w-3xl px-6`. Change to `max-w-[var(--page-narrow)] px-4 sm:px-8`, as in the Deliveries and Activity tabs. Acceptance: switching tabs does not move the content's left edge.

### W2-2. Type scale [A3, Medium]
Replace arbitrary `text-[Npx]` on the traced path with the scale: 11 → `text-meta`, 12 → `text-xs`, 13 → `text-ui`, 14 → `text-body`, 15 → `text-body`, 17 → `text-title`. Files: `rounds-view.tsx`, `extras-view.tsx`, `import-dialog.tsx`, `recap-dialog.tsx`, `delivery-dialog.tsx`, `chase-dialog.tsx`, `project-view.tsx:518,523`, `task-list.tsx:104`, `task-drawer.tsx:584-594`. Leave `pointer-coarse:text-[16px]` in `ui/input.tsx` alone. Acceptance: `grep -rn "text-\[[0-9]*px\]" src/components` shows only that one. [re-checked: four `text-[15px]` remain.]
- **[rendered check]:** line-height changes (e.g. `[12px]` gets 18px, `text-xs` gets 16px), so rows may tighten.

---

## Wave 3: Motion foundations

### W3-1. Reduced motion that keeps meaning [M1, High]

`globals.css:390-397` sets durations to 0.01ms with `!important`. That leaves `.animate-spin` looping at 0.01ms (a flickering arc), erases opacity feedback along with movement, and cannot reach the dnd-kit drop animation or the smooth scroll. Replace the blanket rule with targeted ones:

```css
@media (prefers-reduced-motion: reduce) {
  .animate-slide-in, .animate-pop-in { animation: fade-in var(--dur-1) linear; }
  .animate-shake { animation: none; }
  .animate-spin  { animation: soft-pulse 1.4s ease-in-out infinite; } /* opacity .35 to 1 */
  * { transition-property: color, background-color, border-color, outline-color, opacity, box-shadow !important; }
}
```
Also: `board.tsx:204` passes `duration: 0` when `matchMedia('(prefers-reduced-motion: reduce)')` matches; `board.tsx:181` uses `behavior: reduce ? "auto" : "smooth"`. This completes the item at `docs/PLAN.md:927`.

### W3-2. Motion tokens [M6, Medium]
- Set `--default-transition-duration: 120ms` and `--default-transition-timing-function: cubic-bezier(.2,.8,.2,1)` in `globals.css`, so about 25 `transition-*` sites follow `--dur-1` and `--ease-out`.
- `globals.css:435`: `ease-out` becomes `var(--ease-out)`.
- `board.tsx:204`: `duration: 180` with the shared easing string. `sidebar.tsx:65`: `duration-[var(--dur-2)]`.
- Optional: `useSortable` `transition: { duration: 180, easing: "var(--ease-out)" }` at `board.tsx:322`.

### W3-3. Sidebar exit and card hover [M5, M7, Low]
- `sidebar.tsx:61,65-67`: closed state transitions `transform` with `--ease-in` and delays `visibility` by `--dur-2`; fade the scrim by keeping it mounted with an opacity transition.
- `task-card.tsx:39-40`: remove `hover:-translate-y-px` and `transform` from the transition list (the lift snaps because Tailwind v4 emits `translate`, which is not in the list; border and shadow already carry hover).

---

## Wave 4: Pushing further (where boldness is spent)

Both pieces follow the motion thesis: a task is one object that should visibly arrive where it went, and the delivery is the product's proof. Neither runs ambiently, and both touch only opacity, a 4px transform or background color.

### W4-1. Task lands in Fait [M2, High]
- In `board.tsx` `onDragEnd`, when the target is `DONE` and the origin is not, insert at index 0 so the optimistic order matches the server sort and nothing jumps later (`board.tsx:131-142`, server sort at `:51`).
- Collapsed Done rail (`board.tsx:235-253`): when the count rises, flash `--done-soft` with `@keyframes landed` over 600ms, `--ease-out`. Track the previous length with the render-time sync pattern already at `board.tsx:76-79`. Add `box-shadow` to the rail's transition (`:245`) so its `isOver` ring fades like the column's.
- Reduced motion: color-only, so it is kept as is.

### W4-2. Arrival for non-drag changes [M3, Medium]
Cards and rows whose id was absent in the previous commit get `animate-arrive` (`@keyframes arrive`: opacity 0 → 1, translateY(-4px) → 0, `accent-soft` wash; `--dur-2`, `--ease-out`). Skip on first mount, while `activeId !== null` or a mutation is in flight, cap at 12 elements, and never on a resync where ids are unchanged. Reduced motion: drop the transform, keep the opacity and wash. Applies at `board.tsx:293-295` and `task-list.tsx:155`.
- **[device check]:** on a 100+ card board, and on a phone (the audit found no `TouchSensor`, `MouseSensor` or `touch-action` in `src`, so drag may not work on touch; if confirmed, the non-drag paths are the main way to move tasks on mobile, which is a behavior question outside this design plan).

### W4-3. Project status feedback [M4, Medium]
`project-view.tsx:119` discards `isPending`; `:201-210` has no optimistic value. Use `useOptimistic(project.status)` so the badge flips at once and reverts on error, and add `transition-colors` to the `Badge` base class.

### W4-4. Delivery stamp, the one authored moment [M8, optional]
In `project-view.tsx`, store the saved delivery id from `onSaved` (`:420-425`) as `freshId`, cleared after about 1.2s. The new top row of the timeline (`:488-496`) gets: dot scale 1.8 → 1 over 360ms (`--ease-out`), a ripple on `::after` (scale 1 → 3, opacity .4 → 0, 520ms), content rise 6px over 240ms, and a `--done-soft` wash fading over 900ms. Add `--dur-4: 360ms` and `--dur-5: 560ms` only if this ships. Reduced motion: wash only. It plays only if the Mises en ligne tab is already open; do not auto-switch tabs. Budget: a few times a week.

### W4-5. Route loading UI [M9, Medium]
Add `src/app/(app)/projects/[slug]/loading.tsx`: a static skeleton (header plus 5 columns of card blocks), with no shimmer on more than a handful of blocks, and `animation: fade-in var(--dur-2) ease-out 150ms both` so fast navigations show nothing. **Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` first.**

---

## Wave 5: Still to audit

The Apple-HIG review (accessibility on top of contrast, control sizes, text scaling, interaction, writing, craft) was stopped before it produced anything. Run it again before declaring the surface "done". The checks it should cover:
- 11px `text-meta` usage against a 13/10pt desktop default/minimum.
- Icon-button sizes (`size-7` is 28px; the mobile branch should reach 44px).
- `prefers-contrast` and `forced-colors` handling.
- Action naming through the delivery flow ("Mise en ligne" → "Enregistrer une mise en ligne" → "Mise en ligne enregistrée") against the glossary.
- Empty and error copy.

## Do not do

- View Transitions: they fire only inside transitions, navigations and Suspense, while most state here is plain `setState`; they snapshot the whole board and capture pointer events during the transition; `react@19.2.8` does not export `ViewTransition`, and vitest and happy-dom would see `undefined`.
- FLIP hooks, tab crossfades, popover origin tweaks, toast CSS overrides: no evidence supports them on this path.
- Rebranding. The favicon's cobalt (`#5c8cff`) differs from the UI accents, but `PLAN.md` P2-09 made it a placeholder pending a brand asset. Do not touch it without one.
- Splitting the cobalt accent from the "in progress" role. Shapes already differ; note it as a known decision.

## Sequencing summary

| Order | Task | Size | Needs rendered check |
|---|---|---|---|
| 1 | W0-1 stale tokens plus a guard | S | yes (fresh build) |
| 2 | W1-1 oklab, W1-2 solids, W1-3 ring | M | yes |
| 3 | W1-4 to W1-8 | M | W1-5, W1-8 |
| 4 | W2-1, W2-2 | S–M | W2-2 |
| 5 | W3-1, W3-2, W3-3 | M | no |
| 6 | W4-1 to W4-3, W4-5 | M | W4-2 |
| 7 | W4-4 (optional) | S | yes |
| 8 | Wave 5 audit | | |
