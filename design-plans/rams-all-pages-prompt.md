# Rams review of every page, then apply the enhancements

How to use: open a **new** Claude Code session in this folder (the Rams MCP server only loads at session start), check that `rams` tools are listed, then paste the prompt below as the first message.

---

## Prompt to paste

Run a Rams design review on every page of this app, then apply the UI enhancements it recommends.

Context you must respect
- Read `AGENTS.md` first: this is Next.js 16 with breaking changes. Read the matching guide in `node_modules/next/dist/docs/` before touching any Next API.
- All UI copy is French and follows the glossary in `docs/PLAN.md` §0.4. Use existing tokens in `src/app/globals.css` and the primitives in `src/components/ui/` and `src/components/primitives.tsx`. Do not invent values the repo already has a token for. Keep the identity: ink and cobalt on cool neutrals, status tones with meaning, the waiting-age chip as the product's signature.
- The project page `/projects/[slug]` was already improved on 2026-10-10 (see `design-plans/project-page-enhancement-plan.md`). Review it too, but do not undo those decisions: status solids `--waiting #bb7700` / `--todo #81868f` / `--done #03995f`, `--control` borders, placeholders in `muted`, `--ring`, oklab mixes, `animate-arrive` / `animate-landed` / `stamp-*` motion, reduced-motion rules.
- The repo mixes CRLF and LF line endings. Preserve each file's endings when editing.

Step 1: review. For each group below, run Rams `quick_review` (use `via` set to `rules`) on every listed file. Review one group at a time and keep a running list of findings with file, line, severity and Rams's own recommendation.

| Group | Route | Files |
|---|---|---|
| Login | `/login` | `src/app/login/page.tsx`, `src/app/login/login-form.tsx`, `src/components/pin-input.tsx` |
| Aujourd'hui | `/` | `src/app/(app)/page.tsx`, `src/components/today-actions.tsx`, `src/components/task-row.tsx`, `src/components/waiting-prompt.tsx` |
| Projets | `/projects` | `src/app/(app)/projects/page.tsx`, `src/components/new-project-button.tsx`, `src/components/project-dialogs.tsx` |
| Page projet | `/projects/[slug]` | `src/components/project-view.tsx`, `board.tsx`, `task-card.tsx`, `task-list.tsx`, `rounds-view.tsx`, `extras-view.tsx`, `import-dialog.tsx`, `recap-dialog.tsx`, `delivery-dialog.tsx`, `chase-dialog.tsx`, `project-note.tsx`, `src/app/(app)/projects/[slug]/loading.tsx`, `not-found.tsx` |
| Tâche | `/t/[ref]` and the drawer | `src/app/(app)/t/[ref]/page.tsx`, `src/components/task-drawer.tsx`, `new-task-dialog.tsx`, `quick-add.tsx` |
| Clients | `/clients` | `src/app/(app)/clients/page.tsx`, `src/components/client-contacts.tsx` |
| Facturation | `/facturation` | `src/app/(app)/facturation/page.tsx`, `src/components/billing-view.tsx` |
| Paramètres | `/settings`, `/settings/integrations`, `/settings/journal`, `/settings/templates` | everything under `src/app/(app)/settings/`, `src/components/template-editor.tsx`, `zones-dialog.tsx` |
| Shell | every page | `src/app/layout.tsx`, `src/app/(app)/layout.tsx`, `src/components/sidebar.tsx`, `command-palette.tsx`, `src/app/not-found.tsx`, `src/app/global-error.tsx`, `src/app/(app)/error.tsx` |
| Primitives | shared | `src/components/ui/*.tsx`, `src/components/primitives.tsx`, `dialog.tsx`, `select-menu.tsx` |

Step 2: triage. Merge duplicates (the same problem in several files is one finding). Drop anything that would change behavior rather than presentation, anything that contradicts the glossary or the decisions above, and anything Rams could not support with a concrete rule. For each remaining finding give one correction, the exact file and line, and an exact token or primitive name when one exists. Show me the triaged table (Problem | Evidence | Correction | Files | Severity) and the list of dropped findings with the reason. Wait for my go-ahead before editing.

Step 3: apply. After I confirm, apply the corrections in this order: accessibility and contrast, then token and primitive conformance, then layout and copy, then motion. One commit per group. After each group:
- `npm run typecheck`, `npm run lint`, `npm test`, and `node scripts/contrast.mjs` must pass.
- Re-run Rams `quick_review` (via `rules`) on the files you changed and fix what it still flags.

Step 4: report. Finish with a before/after summary per group, anything you left unfixed and why, and every place that needs a look in a browser. Do not claim anything about how it looks without a screenshot.

---

## Notes
- The user-level rule in `~/.claude/CLAUDE.md` already makes Claude run `quick_review` after UI edits, so Step 3's re-run is consistent with it.
- Rams reads file contents through the hosted service. Do not include `.env`, scripts that hold credentials, or database dumps in a review.
- Not covered by any earlier audit: control sizes (28px icon buttons, 44px on mobile), text scaling, `prefers-contrast` / `forced-colors`, and writing consistency. Ask Rams to look at these explicitly on each group.
