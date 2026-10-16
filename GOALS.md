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

After the automation health, browser workspace, thesis editor, cron dashboard,
terminal hook, organization watchlist, and load-testing checkpoints, a fresh
2026-10-16 working-tree scan found 149,654 hand-maintained frontend lines
across 2,067 candidate files, with 65 files still over 200 lines. The generated
search-route artifact and build/vendor directories are excluded. The working
tree contains concurrent API/database and frontend work, so this is provisional.
Compared with the preceding snapshot, the frontend has 349 more lines and 49
more files while 13 fewer files exceed the cap. The hard cap is not yet met and
the 10,000–30,000-line reduction target remains unachieved; these checkpoints
primarily establish file boundaries and test coverage, not net feature-preserving
LOC reduction.

After the account, upload, GPT, share-search, and TI darkweb checkpoints, the
2026-10-16 working-tree inventory found 151,942 frontend lines across 2,126
hand-maintained files, with 50 files still over 200 lines. The scan excludes
generated search routes and build/vendor directories. Relative to the preceding
snapshot, this is 2,288 more lines and 59 more files, with 15 fewer oversized
files. The current tree includes concurrent API and frontend work, including
uncommitted scopes, so the inventory is provisional. The cap and the
10,000–30,000-line frontend target remain unmet; recent work has mostly moved
responsibilities into clearer files and has not produced net line reduction.

After the logs, rules, prompt portal, traffic table, API-key onboarding,
scaffold, TI enrichment, and share-editor slices, the 2026-10-16 frontend scan
found 153,549 hand-maintained lines across 2,182 candidate files, with 31 files
still over 200 lines. The inventory excludes generated route output and
dependency/build directories. Compared with the preceding snapshot, the count
is 1,027 lines and 39 files higher while 11 fewer files exceed the cap. This
working-tree snapshot includes concurrent, uncommitted work. Several slices
have moved code into meaningful components/hooks without reducing aggregate
LOC; the frontend's 10,000–30,000-line target remains far from met. Continue
removing verified duplicated logic and keep the 200-line cap scan current.

After the TI runs, share-tree explorer, regional traffic-geo, and public-status
copy splits, the 2026-10-16 frontend scan found 154,027 lines across 2,198
candidate files, with 27 remaining over the cap. Relative to the previous
snapshot this is 478 more lines and 16 more files, while four more files now
pass the cap. The added modules make several responsibilities clearer, but
this is still the wrong aggregate LOC direction for the user's 10,000–30,000
line goal. Prioritize verified code/test duplication removal alongside the
remaining cap work; this concurrent working-tree count is provisional.

After the rules, cron, automation, realtime-log, share-socket, webhook-sink,
test-result, and repository-sync splits, the 2026-10-16 frontend scan found
154,513 lines across 2,248 candidate hand-maintained files, with two files
still over 200 lines (`frontend/src/app/thesis/useThesis.ts` at 295 and
`frontend/src/app/api/findings/_tiProxy.ts` at 276). Compared with the prior
snapshot, 25 fewer files exceed the cap, while the frontend added 486 lines
and 50 candidate files. The cap is not yet satisfied, and the 10,000–30,000
line objective remains far away; continue looking for verified duplication
removal after the two remaining cap violations are addressed.

After the thesis editor, business-model evidence, and TI proxy responsibility
splits, the 2026-10-16 working-tree scan found 154,790 lines across 2,256
candidate hand-maintained frontend files. The full frontend line-cap checker
now passes with no files over 200 lines. Compared with the preceding snapshot,
the inventory grew by 277 lines and eight candidate files; the new modules have
made behavior boundaries clearer, but aggregate code reduction is still not
being achieved. The 10,000–30,000-line frontend target remains outstanding.

After the current frontend/API extraction and contract-check updates, the
2026-10-16 scan found 154,990 frontend lines across 2,267 candidate
hand-maintained source/config files. The 200-line cap passes for every file in
that scan. Relative to the previous snapshot this is 200 more lines and 11 more
files; the cap is satisfied, but the 10,000–30,000-line frontend target remains
far from met and net line reduction is still not being achieved. This working
tree is provisional and includes concurrent refactors. The scan covers source,
tests and configs while excluding dependencies, build output and the generated
search-route artifact.

After the organization disclosure, management-search shortcut, dashboard
smoke-session, and TI decision-status changes, the 2026-10-16 frontend scan
found 155,031 lines across 2,273 candidate hand-maintained files, with no file
over 200 lines. The default frontend suite and production build passed for this
checkpoint. The 10,000–30,000-line frontend target remains unmet; compared with
the prior 154,990-line snapshot, this checkpoint is 41 lines larger and has
six more files. API extraction is underway in the 11k-line admin-support and
webhook modules, but the API-wide cap and 100,000-line reduction goal remain
unmet. The working-tree inventory is provisional while those refactors
continue.

The new repository-wide `node scripts/check-line-cap.mjs` scan currently sees
3,494 hand-maintained code/config files and 321,380 lines (excluding generated
OpenAPI/search routes, dependencies, build output, and monitoring evidence).
It reports 130 files over 200 lines: 122 under `api/`, five under `ops/`, and
three at the repository root or in shared scripts. The frontend portion passes
with zero over-limit files. The scan is an explicit progress guard; it is not
yet wired into the default build while the existing API debt is being removed.

After the organization, traffic dashboard, and shared date-formatting
checkpoints, the frontend scan covers 2,275 hand-maintained files and 155,066
lines, with zero files over 200 lines. The full frontend test suite and
production build pass for commit `eee81074b`, pushed to both configured
remotes. Relative to the preceding 155,031-line snapshot, the frontend now has
35 more lines despite local production-code reductions; the 10,000–30,000-line
target remains unmet. The integrated repository scan currently finds 3,519
files / 321,539 lines and 130 over-limit files (122 API, five ops, two shared
scripts, and one root Compose file). API extractions are still in progress, so
these counts are provisional.

At the 2026-10-16 checkpoint ending at `5bf5c4a3b`, the frontend cap scan covers
2,292 hand-maintained source/config files and finds none over 200 lines. The
same scoped inventory totals 155,095 lines, up 64 from the previous 155,031-line
snapshot; recent exact-duplicate consolidations have removed about 241
production lines, but tests/modules keep aggregate LOC from falling. The last
full frontend suite and production build both passed at `a1b02d2d5`; subsequent
frontend commits have passed focused tests, full typecheck, lint, and cap
checks, with a fresh full suite/build still due. The latest repository-wide
scan reports 3,562 hand-maintained files / 321,650 lines and 130 over the cap.
The current `adminSupport.ts` is 6,096 lines and `webhooks.ts` is 9,930 lines;
their current extraction checkpoint adds aggregate implementation LOC, so the
100,000-line API reduction and 10,000–30,000-line frontend target remain
unachieved. Counts are provisional during concurrent refactors.

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
