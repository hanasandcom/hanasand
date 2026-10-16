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

After the shared backend-auth headers, article/thought dashboard queue,
organization timestamp write, and webhook retry-test checkpoints, the frontend
scan covers 2,296 hand-maintained files and 155,168 lines, with no file over
200 lines. Its full test suite and production build pass at commit
`4a84ffb59`; the later API-only test split at `0f8199eba` does not change
frontend inputs. The frontend count is 73 lines above the prior 155,095-line
snapshot despite the auth-header consolidation removing 20 production lines;
the dashboard component improves shared rendering but adds four production
lines after call-site overhead. The frontend's 10,000–30,000-line objective
remains unmet.

The global scanner currently reports 3,579 hand-maintained files, 321,745
lines, and 129 files over the cap. This working-tree count includes Einar's
in-progress organization-route split and is provisional. The API-wide
100,000-line reduction and repository-wide 200-line cap remain outstanding;
the API webhook test restructuring removed 47 net lines while preserving all
19 cases and 94 direct assertion calls.

After the TI admin-table and browser provider-badge components, the 2026-10-16
frontend inventory finds 2,299 hand-maintained source/config files and 155,239
lines, with zero files above the 200-line limit. The frontend test suite and
Next production build pass at `614a69a60`. Across the four recent frontend
reuse slices (backend auth headers, article/thought queue, TI admin tables, and
browser provider badges), production code is down 45 lines; the full inventory
is nevertheless 71 lines above the prior 155,168-line checkpoint because the
new tests and modules add more than those slices remove. The required
10,000–30,000-line frontend target remains unmet, so continue prioritizing
verified duplication removal in addition to the satisfied file cap.

At `bf424fbd3`, the TI activity page reuses the existing dashboard metric card
with a size option that preserves the old activity and overview classes. Its
production pair is down 12 lines, and the frontend full test suite, production
build, and 200-line cap pass. The latest scoped inventory is 2,300 frontend
files / 155,250 lines / zero over cap: eleven more total lines than the prior
snapshot after adding its render contract test. The integrated repository
inventory is 3,631 files / 322,252 lines, with 128 files still over the cap.
The API and frontend aggregate reduction targets remain unachieved.

At `a9a192a67`, the frontend cap scan covers 2,307 files / 155,338 lines and
passes with zero files over 200 lines. The full frontend test suite and Next
production build pass. The content-editor header and findings/TI loading
consolidations remove 10 production lines together; the total frontend
inventory is 88 lines above the `bf424fbd3` snapshot because tests and modules
still outweigh localized savings. The global scanner reports 3,653
hand-maintained files / 322,414 lines, with 126 files over the cap, down from
128 but up 162 aggregate lines since the prior integrated snapshot. The
organization alert/readiness and case-visibility extraction is independently
reviewed and verified, but its route tree totals 4,173 lines versus the 3,855
baseline (+318) and `organizations.ts` remains 803 lines. The 100,000-line API
reduction, 10,000–30,000-line frontend target, and repository-wide cap remain
unmet; subsequent work must measure aggregate LOC and keep prioritizing actual
duplication removal over file splitting alone.

At `f8d4b6d71`, the frontend inventory is 2,310 hand-maintained files / 155,352
lines, with zero files over 200. The full frontend suite and production build
pass. The dashboard article/thought row now shares one implementation while
preserving existing exports, reducing those production implementations from 98
to 78 lines. API note normalization is shared between create and update, and
the DWM alert-normalization extraction reduces the webhook compatibility barrel
by 201 lines with four lines of aggregate module overhead. The global scan is
3,656 files / 322,441 lines with 126 over the cap. The frontend aggregate is
14 lines above the prior `a9a192a67` snapshot; these localized reuse wins do not
yet deliver the 100,000-line API reduction or 10,000–30,000-line frontend
target. The full repository cap remains unmet.

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

At the current frontend checkpoint, the cap scanner covers authored source,
tests, configuration, Markdown/text, SVG, and common frontend source formats.
It excludes generated `bun.lock`, static article data, and search routes. The
latest scan reports 2,326 files / 155,717 lines, with zero files over 200;
the expanded scanner and changed-file scan pass. The full frontend suite and
production build both pass with the latest scanner. The frontend aggregate remains
well above the 10,000–30,000-line target. The repository-wide scan reports
3,674 files / 322,543 lines, with 125 over the 200-line cap; the API reduction
target and global cap remain unmet.

At this checkpoint, frontend request-hostname resolution is shared by the auth
cookie and backend proxy paths. The refactor removes 10 production lines,
registers three focused behavior tests in the default test runner, and preserves
forwarded-host, host, and URL fallback order. Independent review and the full
frontend test suite, typecheck, scoped lint, cap scan, and production build
pass. The support-session route remains separate because it intentionally
lowercases the result.

At the next frontend checkpoint, `/ai`, `/ai/window`, and `/ai/[id]` share one
server loader, reducing those route implementations from 108 to 59 production
lines while preserving cookie handling, parallel reads, workspace props, route
selection, and `/ai` metadata. A contract test covers all three pages. The
default test runner now includes 71 previously unregistered Bun unit-test
files; all pass, and the six stale source/route expectations were updated to
the current implemented contracts. The homepage exposure feed also moves from
`checking` to `unavailable` after a failed initial fetch with no saved rows,
while retaining saved rows on refresh errors.

The 2026-10-16 frontend cap scan covers 2,332 authored source/config files and
155,898 lines, with no file over 200. The full frontend unit suite, production
build, non-incremental typecheck, scoped ESLint, and cap check pass. Repository
scan currently reports 3,680 files / 322,724 lines / 125 over-cap files, all
outside the frontend. Full-repository lint currently exits nonzero with 1,633
errors; every file changed in this checkpoint passes scoped ESLint. The
frontend 10,000–30,000-line target and API reduction target remain unmet; this
checkpoint adds substantial test execution coverage but only removes 49 net
production lines from the shared AI loader refactor.

At frontend checkpoint `777a88cb9`, five audit, TI, traffic, and vulnerability
views share one Europe/Oslo timestamp formatter. The production changes remove
21 net lines across those consumers and the helper; the characterization test
adds 122 lines and checks January/July output for all five callers. The
registered focused test, full frontend test suite, non-incremental typecheck,
scoped ESLint, guardrail lint, cap scan, and production build pass. The
frontend cap scan covers 2,334 files / 156,000 lines with zero over 200. This
is 102 more total frontend lines than the preceding inventory, because the new
contract test and module outweigh local production savings. The repository
scan is 3,689 files / 322,868 lines with 125 files over cap, all outside the
frontend. Independent review found no behavioral or security blocker in the
current admin-support and webhook extractions; their parent files remain
oversized and their aggregate LOC reduction targets remain unmet.

At frontend checkpoint `ProfileLinkCard`, the identical profile navigation
card markup is shared by the dashboard and management greeting headers. The
component preserves the same profile route, desktop classes, icon placeholder,
and label; the 14-line SSR test checks these output details. This reuse adds
three production lines after imports and component definition. The focused
test, full frontend suite, non-incremental typecheck, scoped ESLint, guardrail
lint, cap check, and production build pass. The cap scan now covers 2,336
frontend files / 156,019 lines with zero over 200. Relative to the previous
checkpoint, the frontend inventory grows by 19 lines; aggregate LOC reduction
remains a priority alongside the hard cap.

At API checkpoint `8973f4849`, independently reviewed access-recovery, audit
detail, webhook preview, notification-input, and dispatch-planning
responsibilities are in focused modules below 200 lines. The admin-support
parent fell from 6,096 to 5,463 lines, while its module family grew from
13,959 to 13,983 (+24). The webhook parent fell from 9,719 to 9,151 lines;
its module family grew from 12,167 to 12,230 (+63), including five extracted
modules and a small utility seam. Moved function bodies were checked against
the prior implementation, and focused route, access-recovery, webhook,
typecheck, scoped ESLint, and diff checks pass. These are responsibility
boundaries with small aggregate overhead, not meaningful net code reduction;
both parent files still exceed the hard cap by thousands of lines. The
repository scanner now finds 3,695 files / 322,934 lines and 125 files over
200, all outside the frontend. Frontend remains at 2,336 files / 156,019 lines
with zero over-limit files. The 100,000-line API shrink and 10,000–30,000-line
frontend goals remain unmet; keep measuring family totals and focus on
verified duplicate removal.

At checkpoints `b92e091fd` and `e1dd46ae2`, the admin-support inspection path
was split into request, data, validation, proof, and presentation modules, all
under 200 lines. The route body is now 83 lines; focused audit tests (6 / 50
assertions), API typecheck, full default API suite, scoped ESLint, and
independent review pass. This improves the responsibility boundaries but adds
about 180 LOC to the admin-support family (14,157 total), mainly for proof and
response coordination; it is not aggregate reduction. The webhook delivery
path now reuses the normalized alert/watchlist already present in the payload,
preserving serialization and avoiding duplicate normalization; it removes 2
production lines and adds 10 focused persistence assertions. Independent
review and five affected DWM tasks pass. Frontend remains 2,336 checked
source/config files / 156,018 lines, with zero over 200. The repository scan
reports 3,706 hand-maintained files / 323,222 lines and 125 over the cap, all
outside the frontend. The API 100,000-line reduction and frontend
10,000–30,000-line target remain unmet; further work must prioritize measured
net reductions while keeping the frontend cap and existing page data/UI
contracts intact.

At API checkpoint `c8b138c94`, six webhook read models share a typed access
capability mapper. The webhook production family falls by 19 lines (9,793 to
9,774), while its focused visibility contract test grows by 46 lines; this is
not a net repository LOC reduction. Kari's independent review found the
permission keys, ordering, and boolean behavior unchanged. All 27 registered
DWM tasks, scoped ESLint, and diff-check pass. The frontend cap scan still
passes for 2,336 files / 156,018 lines with zero over 200. The repository scan
now covers 3,706 hand-maintained files / 323,190 lines and reports 125 over
cap, all outside the frontend. The current admin-support extraction is
uncommitted and fails API typecheck; do not integrate it until the type errors
and focused checks are resolved. The 100,000-line API reduction and
10,000–30,000-line frontend targets remain unmet.

At webhook checkpoint `90cd110d4`, three DWM receipt builders share their
identical organization, alert, watchlist, and provenance context. The
production family falls from 9,772 to 9,757 lines (-15); the focused contract
test grows from 111 to 136 lines. The added assertions verify shared values
across transition, case-action, and source-handoff receipts. Kari's review
found no behavior or redaction issue; 16 affected cases / 85 assertions,
typecheck, scoped ESLint, and diff-check pass. The committed repository
inventory is 3,706 files / 323,232 lines / 125 over the cap; an active
admin-support edit is reducing its route file but is not included in that
checkpoint. Frontend remains 2,336 files / 156,018 lines with zero over 200.
