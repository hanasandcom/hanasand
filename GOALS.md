# Repository Refactor Goals

## Outcome

Refactor the repository for clear responsibilities, readable code, reuse where
contracts match, and maintainable tests while preserving existing product
behavior and features. Reduce duplicated and ineffective code; keep measuring
source, tests, generated output, and configuration separately against the
recorded baseline. The API source reduction target remains at least 100,000 lines without
feature loss. The frontend is also in scope: reduce its current 153,708
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

At API checkpoints `1ee9a4b8a` and `f40a4f086`, the access-recovery approval
search now lives in a 107-line module and the webhook test-alert builder lives
in the payload-preview module. Both preserve their public exports and existing
route/call-site behavior; independent reviews found no regression. Focused
approval-search tests (16 cases across three suites), DWM contract/security
tests (10 cases / 212 assertions), typecheck, scoped ESLint, and diff checks
pass. The admin-support parent is now 4,619 lines, but its family grew by 11
LOC for this split. `webhooks.ts` is 8,806 and `payloadPreviews.ts` is 192; the
test-alert move reduces the parent by 21 but adds 24 module lines (+3 net).
These moves advance the hard cap, not aggregate reduction. The committed
repository scan is 3,707 files / 323,246 lines, with 125 over 200; all
frontend files still pass at 2,336 files / 156,018 lines. The 100,000-line API
reduction and 10,000–30,000-line frontend goal remain outstanding.

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

At checkpoints `07560a716`, `85cb984ae`, `2b3f9d89d`, and `4470391b3`, four
more DWM builder families moved behind the same public `webhooks.ts` API:
delivery timeline, persistence proof, replay contract projection, and history
consumer. Each extraction is independently reviewed and its registered focused
tests, typecheck, scoped ESLint, and diff checks pass. The parent is now 8,275
LOC; the nested DWM modules total 1,500 LOC and the shared value utility is 64
LOC. These moves reduce the parent by hundreds of lines but add structural
family overhead; they are cap progress, not aggregate reduction.

At `2078362a6`, the member-role recovery route and its helpers were split into
cohesive modules, all ≤200 lines and free of the reviewed runtime cycle. The
route barrel export, auth/scope/idempotency, transactional rechecks, audit and
receipt contracts are preserved. The parent falls from 4,619 to 3,532 LOC;
its feature family grows by 192 LOC. The two isolated focused tasks pass
10/10 (53 assertions), along with API typecheck, scoped ESLint, diff check and
independent review. The committed global scan is 3,728 files / 323,484 lines,
with 125 files still over 200, all outside the frontend. Frontend remains at
2,336 checked files / 156,018 lines with zero over 200. These cap splits do
not satisfy the API 100,000-line reduction or frontend 10,000–30,000-line
target; net family LOC and useful test coverage remain required metrics.

At `ced52a04c`, webhook retry work-order projection is extracted behind the
existing `webhooks.ts` API. Kari's independent review confirmed unchanged
projection precedence, payloads, counts, access/visibility and exports; the
focused projection and route suites pass 13 tests / 64 assertions, and the
author reports typecheck, scoped ESLint, cap and diff checks passing. This
reduces the parent by 95 LOC but grows the feature family by 12 LOC, so it is
cap progress rather than net reduction. Both `origin/main` and `github/main`
were verified at this commit. The committed global inventory is 3,743 files /
323,565 LOC / 125 over 200. The frontend cap scan passes at 2,336 files /
156,018 LOC with no over-limit files. A read-only frontend reuse review found
no safe shared-component extraction with meaningful net savings in its bounded
pass; authored TS/JS inventory is 117,691 LOC under `src`, 25,379 under tests,
and 10,354 under scripts. The aspirational 10,000–30,000 frontend target is
not yet supported by evidence for behavior-preserving reduction at that scale;
continue removing verified duplication and dead code without changing UI or
page data contracts, and reassess from measured feature-family totals.

At `405709570` and `5bc5c6170`, the access-recovery request route and webhook
destination delivery matrix were independently reviewed and committed. The
admin-support parent falls 317 LOC (2,706 to 2,389) while its new request
modules add 421 (+104 family LOC). The webhook parent falls 129 LOC (8,024 to
7,895) while its projection adds 175 (+46 family LOC). Access recovery,
session-lifecycle, organization-helper, destination-health, visibility-access,
and delivery-route focused suites pass when run one file at a time; API
typecheck, scoped ESLint, and diff checks pass. A combined multi-file `bun test`
invocation produced `withDatabaseAdvisoryLock` export errors from test module
mock interference; all affected files then passed in separate serial
invocations. Track test isolation as a test-quality issue rather than counting
that combined invocation as product behavior failure. Both remotes were pushed
through `5bc5c6170`. At that code checkpoint the global scan was 3,750 files /
323,711 LOC / 125 over 200. The frontend scan still passes at 2,336 files /
156,018 LOC with zero over 200; no frontend code changed in these API slices.

At frontend checkpoint `fd3b2c4ca`, eleven public TI payload models compose on
`PublicActorContext`, and nine selected-plan models also share their selected
item ID/title contract. This is type-only: creators, serialized fields, page
data, and UI markup are unchanged. It removes 40 net authored frontend lines.
The TI safe-output contract test, non-incremental typecheck, scoped ESLint,
diff-check, and frontend cap pass. The scanner now covers 2,337 files /
155,978 LOC with zero over 200. The 10,000–30,000-line ambition remains
unproven; continue only on verified duplication or dead logic that preserves
all page data and UI behavior.

At `eed5dbfd8`, the existing PostgreSQL log phrase-search test is registered
as an opt-in database task and has a guarded package command. The task runner
policy suite passes 8 tests / 79 assertions. The real PostgreSQL test was not
run because no explicitly configured disposable `logs_test` database was
available; its environment guard remains required. This change makes the
existing integration coverage discoverable without treating a missing local
database as test evidence.

At `db932b9f5`, the support access-recovery decision route is split into
focused route, mutation, audit, response and type modules, preserving the
registered route exports and reviewed auth, transaction, audit and receipt
contracts. `adminSupport.ts` falls from 2,389 to 2,051 lines; the extracted
modules total 420 lines, so the feature family grows by 82 LOC. Kari's
independent review found no behavior regression. Access-recovery tests pass
6/6 (31 assertions); API typecheck, scoped ESLint and diff checks pass.

At `0cdbf90e2`, the webhook destination lookup projection is moved behind the
existing public `webhooks.ts` API. The parent falls from 7,895 to 7,783 lines
and the new projection is 129 lines, growing the feature family by 17 LOC.
Kari's independent review confirmed the denied-input gate, lookup precedence,
fields, visibility and ordering remain unchanged. Destination-health,
lifecycle-blocker and lifecycle-truthfulness suites pass 13/13 (54 assertions),
with API typecheck, scoped ESLint and diff checks passing.

The current repository cap scan covers 3,759 hand-maintained files / 323,787
LOC and still reports 125 files over 200 lines, all outside the frontend. The
frontend checker passes for 2,337 source/config files / 155,978 LOC with zero
over-limit files. These API moves improve file boundaries but increase total
feature-family LOC; neither the 100,000-line API reduction nor the 10,000–30,000
frontend target has been achieved. Continue only where verified reuse or dead
code removal preserves behavior, and measure net family LOC alongside cap
progress.

At `6b19a2507`, webhook delivery audit-trail projection is extracted behind
the existing public builder. The parent falls from 7,783 to 7,644 lines; its
new 174-line module raises the webhook family from 9,883 to 9,918 LOC (+35).
Kari's independent review confirmed access redaction, retry/test request
selection, blocker and entry ordering, route strings, counts, and summary
truncation are unchanged. Projection, delivery-route, and visibility suites
pass 16 tests / 85 assertions; guarded contract smoke, typecheck, scoped ESLint
and diff checks pass. This is file-cap progress rather than net LOC reduction.

At frontend checkpoint `83fea499c`, five TI workbenches share the same
selected-row-preserving preview and expansion control. Callers still own their
labels, CSS classes and feature row data; the rendered behavior and page-data
contracts remain unchanged. The five production components plus the shared
component fall from 817 to 808 LOC (-9). Its focused suite is registered and
passes 4 tests / 11 assertions; non-incremental frontend typecheck, scoped
ESLint and diff checks pass. The full frontend cap scan passes for 2,339
source/config/test files / 156,026 LOC with zero over-limit files. The added
test and runner entry make total frontend lines higher than the prior scan;
this is a reuse improvement, not material progress toward the 10,000–30,000
LOC target. Continue with measured duplicate behavior and keep all page data
and UI contracts stable.

The integrated frontend checkpoint also passes the full `bun run test` suite
and the production `bun run build`; Next generated all 116 static pages and
listed the expected application routes. The build regenerated only ignored or
unchanged generated content. No rendered UI or page payload changes were made.

At the current API maintenance checkpoint, `economics.ts` falls from 975 to
807 LOC by moving its reliability projection, row contracts and shared numeric
normalizer into three purpose-named modules. The production family grows by
3 LOC (975 to 978); the existing output fields and incident precedence are
unchanged. A new 118-line unit suite adds fixed GPU, queue, cost and incident
precedence expectations. Kari's independent review found the extracted source
matches the prior implementation. The new suite passes 3 tests / 11
assertions; the existing endpoint suite passes 1 / 8.

The DWM delivery-projection tests are separated into evidence/history,
readiness/retry, destination selection and combined read-model suites. The
delivery-route suite is separated into access gates and retry outcomes. Shared
fixtures own mocks and reset state; all touched tests and fixtures are below
200 LOC, and all original behavior cases remain. Same-builder comparisons were
replaced with fixed sparse/populated expectations while independently
important cross-builder idempotency, combined-read-model and destination
projection parity assertions were retained after review. The test/fixture
family grows from 620 to 717 LOC (+97) to provide independent regression
oracles. All 14 focused DWM cases / 66 assertions, the AI reliability suite,
runner-policy suite (8 / 79), API typecheck, scoped ESLint, and the full default
API test runner pass. The default runner excludes 37 database-required suites;
they were not run.

The current repository scan covers 3,772 hand-maintained files / 324,089 LOC
and still finds 123 files over 200 lines, all outside the frontend. This is a
two-file improvement in the cap count from splitting the DWM tests; the API
economics parent remains over the cap. The latest frontend scan continues to
pass at 2,339 source/config/test files / 156,026 LOC with zero over-limit
files. These checkpoints improve ownership and test quality but do not provide
material aggregate LOC reduction; the API 100,000-line reduction and frontend
10,000–30,000-line target remain unachieved.

After removing the independently verified unreachable frontend component
closure (27 modules plus two stylesheets, approximately 1,017 source lines),
the frontend scanner reports 2,311 hand-maintained source/config/test files
and 154,963 lines, with zero files above 200 lines. The working-tree total is
1,063 lines lower than the preceding 156,026-line scan; the 10,000–30,000-line
target remains unmet. The removal was verified against static imports,
re-exports, dynamic imports and runtime/script references in the deployed
top-level frontend. The generated search-route output remains excluded.

The organization-list and audit-timeline Cmd/Ctrl+J handlers now share the
existing tested shortcut predicate from a neutral utility; user-list and
service-account consumers use the same function. The shortcut contract test,
scoped ESLint, non-incremental typecheck, full frontend test runner, line-cap
scan and production build pass. Next generated all 116 static pages and kept
the application route set. No UI or page-data contract changes were intended.

The API visibility-policy and TI scheduled-job extraction checkpoints are
committed locally at `a95ad7153` and `20c189efe`. Organization role/helper
tests, isolated cron cache/automatic-review/runtime/monitor suites, API
typecheck, scoped ESLint and diff checks pass. The TI job family's extracted
modules preserve the prior requests, job order, telemetry and projection
values; its production family grows by 34 LOC. The organization visibility
family grows by 4 LOC. The integrated repository scan now finds 3,752
hand-maintained files / 323,064 LOC and 123 over-limit files, down 20 files
and 1,025 LOC from the preceding scan. API-wide 100,000-line reduction and
repository-wide file-cap goals remain outstanding.

Since frontend checkpoint `eca8b03d9`, the verified Findings portal loaders now
share their identical no-store fetch, response-error and JSON lifecycle; the
case loader retains its distinct retry and stale-row semantics. Focused tests
cover all four resource mappings, optional alert/delivery arrays, structured
errors, abort behavior, no-store cache and signal forwarding. Traffic response
guards are shared between the overview data service and recent-traffic route,
and the map passes one country-selection callback to both consumers. Focused
Findings/traffic tests, ESLint, non-incremental typecheck, the full frontend
test runner, line-cap scan and production build pass; Next generated all 116
static pages. The updated frontend inventory is 2,313 files / 155,023 LOC / zero
over 200 lines. This is 60 lines above the prior 154,963-line scan because the
checkpoint adds behavior-specific regression tests and shared validation
code; it removes repeated production logic locally but does not constitute
meaningful progress toward the 10,000–30,000-line objective.

Since frontend checkpoint `749ceb274`, the browser
report reuses the browser workspace's existing VirusTotal vendor-label helper;
fixed-output tests cover zero, nonzero and missing totals. The dashboard
tenant-overview test is replaced by a rendered organization snapshot check for
scoped links and visible watch-term/alert counts; one focused route-source
guard remains for the explicit prohibition on unscoped platform metrics. The
duplicate source assertion was removed. The frontend suite, non-incremental typecheck,
scoped ESLint, cap check and production build pass; Next generated all 116
static pages. The AI GitHub client now shares JSON parsing and error handling across its
eight operations; runtime tests preserve each endpoint, payload, result and
fallback error. The frontend scan is 2,313 files / 155,092 LOC / zero over 200.
The repository scan is 3,754 files / 323,193 LOC / 123 over 200, all outside
the frontend. These checks improve reuse and behavioral coverage, but do not
materially reduce aggregate frontend LOC; the 10,000–30,000-line target and
repository-wide cap remain unmet.

After the shared Git workspace-operation lifecycle and source-readiness test
checkpoint, the frontend cap scan passes at 2,314 hand-maintained files /
155,329 LOC / zero over 200. The full frontend test runner, non-incremental
typecheck, scoped ESLint, and Next production build pass; Next generated all
116 static pages. The workspace operations preserve their existing signed-in
guards, request IDs, state transitions, status text, sync timestamps, and
fallback errors, now covered across all four operations. The dedicated test is
exactly 200 lines. The repository scanner reports 3,755 hand-maintained files
/ 323,430 LOC / 123 over 200, all outside the frontend. This checkpoint improves
operation reuse and regression coverage but is not net frontend LOC reduction;
the 10,000–30,000-line target and repository-wide cap remain unmet.

At frontend checkpoint `TrafficPageState`, the overview, live-map, and recent
traffic routes share their identical loading/unavailable panel markup while
retaining route messages, classes, accessibility roles, Suspense keys, and
data loading. A rendered-output test verifies the shared states. The full
frontend suite, production build (all 116 static pages), line-cap scan, and
scoped ESLint pass. The inventory is 2,316 hand-maintained frontend files /
155,370 LOC / zero over 200. The repository scan reports 3,757 files /
323,471 LOC / 123 over 200, all outside the frontend. The production component
change is a small consistency improvement; the frontend's 10,000–30,000 LOC
objective and the repository-wide cap remain unmet.

The repository-to-share workflows now use one shared parent-folder traversal
and folder-tree registration helper across scaffold, sync, and import. Their
combined production family falls from 402 to 329 LOC (−73). Tests preserve
12-character scaffold IDs, default sync/import IDs, import-root-first order,
folder reuse/deduplication, progress ordering, and path-specific failures. The
focused workflow and adjacent template/prune tests pass; so do the full
frontend suite, non-incremental typecheck, scoped ESLint, cap scan, and Next
production build (116 static pages). The frontend inventory is 2,318 files /
155,429 LOC / zero over 200. Repository inventory is 3,759 files / 323,530 LOC
/ 123 over 200, all outside frontend. This is a verified production LOC
reduction, while the 10,000–30,000-line frontend and 100,000-line API targets
remain unmet.

The disconnected share `PreviewFlow` and its private runtime-guessing helper
were removed after route/import/history checks confirmed that the active share
route had stopped mounting this flow. Together they remove 348 production LOC.
The existing share-tree test now checks the active runtime-capability helper,
and the dark-theme source guard now checks the mounted `RenderSite`. No current
route, rendered UI, or page-data behavior changed. Full frontend tests,
non-incremental typecheck, scoped ESLint, line-cap scan, and Next production
build pass; all 116 static pages generate. The frontend inventory is 2,316
files / 155,080 LOC / zero over 200. The repository scanner reports 3,757
files / 323,181 LOC / 123 over 200, all outside the frontend. The standalone
dark-theme guard still fails on existing assertions in other pages/components;
the new `RenderSite` assertion passes. The 10,000–30,000-line frontend and
100,000-line API reduction targets remain unmet.

The retired NorthStar/product-readiness aggregate implementation and its
unregistered manual checker are removed: 1,397 lines deleted, with a 79-line
registered current-product readiness contract test, for a net reduction of
1,318. Active product-progress APIs, workbench readiness, source-proof logic,
and the receipt-matrix schema remain. The shared auth-cookie writer removes
about 53 duplicated production lines; tests exercise local/shared domain
attributes, full clearing, and backend token refresh/expiry. The stale
Helpdesk browser suite is reduced from 144 to 24 lines and now covers the
authenticated legacy redirect/current audit view; product UI is untouched.
Across checkpoints since `3a0bc4d10`, frontend/src is down 1,767 lines and
frontend tests/scripts are up 256, a combined reduction of 1,511. The integrated
frontend suite, non-incremental typecheck, scoped ESLint, 200-line cap, and
production build pass; Next generates all 116 static pages. The frontend scan
is 2,305 files / 153,708 LOC / zero over 200. The repository scan is 3,746
files / 321,809 LOC / 123 over 200, all outside the frontend. The standalone
dark-theme checker still fails on existing assertions outside the new share
renderer guard, and focused Playwright could not start because its configured
local API server exits during startup. The frontend 10,000–30,000 LOC and API
100,000-line reduction goals remain unachieved.
