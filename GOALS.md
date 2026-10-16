# Repository Refactor Goals

## Outcome

Refactor the repository for clear responsibilities, readable code, reuse where
contracts match, and maintainable tests while preserving existing product
behavior and features. Reduce duplicated and ineffective code; keep measuring
source, tests, generated output, and configuration separately against the
recorded baseline. The API source reduction target remains at least 100,000 lines without
feature loss. The frontend is also in scope: reduce its current roughly 145,000
hand-maintained lines to no more than 30,000, aiming for 10,000–30,000 where
that preserves clear ownership and complete functionality. Keep rendered UI,
interactions, accessibility behavior, and page data contracts stable. Prefer
shared React components and behavior when real consumers share the same
contract; keep distinct presentation and data needs explicit.

## Hard file-size requirement

- No hand-maintained source, test, script, or configuration file may exceed
  200 physical lines.
- This limit applies equally to the frontend: pages, React components/hooks,
  tests, scripts, styles, and configuration are all in scope. Prefer cohesive
  reusable UI components where consumers share the same behavior, and preserve
  rendered UI, accessibility, routes, and page data contracts while splitting.
- Split files at natural responsibility boundaries. Keep route entrypoints,
  domain rules, persistence, and presentation separate where they have
  independent reasons to change.
- Do not create one-function fragments, generic abstraction layers, or arbitrary
  file splits just to satisfy the limit. Each new module must have a coherent
  domain purpose and real consumers.
- Inventory every tracked file in scope, record current line counts, and verify
  the cap across the repository at completion. Track generated/vendor/build
  artifacts separately and do not hand-edit generated output.
- Preserve behavior with characterization tests before moving code. Update
  imports, package exports, test ownership, and documentation with each split.

## Initial inventory

The 2026-10-16 working-tree survey, before file splitting, found 282
hand-maintained code/test/config files over 200 lines (136 under `api/`, 139
under `frontend/`, five under `ops/`, one under `db/`, and the root Compose
configuration). Those files total 190,433 lines. Three generated OpenAPI and
search-route artifacts over 200 lines are tracked separately. This snapshot
includes the pending API-key migration test changes.

## Progress snapshot

On 2026-10-16, after the first frontend checkpoints (`68df582aa` and
`b70fd74df`) and while additional refactors were in progress, a working-tree
inventory of hand-maintained source, tests, scripts, styles, SQL, and selected
configuration files found 240 files over 200 lines: 122 in `api/`, 110 in
`frontend/`, five in `ops/`, none in `db/`, and three at the repository root.
The frontend scope contained 148,556 lines across 1,772 candidate files. The
inventory excluded generated OpenAPI/search-route artifacts and build/vendor
directories. It includes uncommitted work, so refresh it after each major
integrated milestone. This is a structure/size inventory, not evidence of net
feature-preserving line reduction: many completed changes split files without
reducing total implementation lines. The 100,000-line API reduction goal and
the 10,000–30,000-line frontend goal remain unachieved.

After the traffic map, share-chat, actor workbench, system dashboard, TI search,
TI admin, public TI, guardrail, Git plugin, and dashboard sidebar checkpoints,
the 2026-10-16 frontend inventory is 147,557 lines across 1,972 hand-maintained
`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.css`, and `.json` files, with 85
files still over 200 lines. It excludes dependency/build output and generated
route/type artifacts. Compared with the prior 147,516-line, 1,942-file snapshot,
this is 41 more lines, 30 more modules, and five fewer oversized files. The
current inventory includes concurrent uncommitted work and is provisional.
Recent splits focus on behavior-preserving responsibility boundaries; their
module overhead has not yet reduced the frontend toward its required
10,000–30,000-line end state.

After the login, TI dashboard, share-tree, site-search, system AI, and terminal
checkpoints, a fresh 2026-10-16 inventory found 149,305 hand-maintained
frontend lines across 2,018 candidate `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`,
`.cjs`, `.css`, `.json`, `.toml`, `.yaml`, and `.yml` files, with 78 still over
200 lines. The inventory excludes dependency/build output and the generated
search-route artifact. It includes concurrent uncommitted refactors and is
provisional; the latest splits meet the file cap but have increased total
frontend lines through module overhead rather than materially shrinking the
implementation.

## Execution

- Divide work by non-overlapping repository areas and use traditional Norwegian
  names for delegated workers.
- Have each worker inventory its area, split overlong files by functionality,
  remove verified duplication, run focused checks, and request independent
  review. The integrator owns shared Git state, integrated verification,
  regular commits and GitHub pushes.
- Do not remove useful coverage to reduce lines. Replace weak source-text checks
  with runtime or database behavior tests when the needed isolated environment
  is available.
- Finish only after the line inventory passes, all changed behavior is tested,
  full relevant checks pass, the integrated changes are pushed, and deployment
  is verified through the repository's documented workflow.
