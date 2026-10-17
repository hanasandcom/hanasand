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

The saved-browser-finding history dialog and browser workspace now share one
native-share/clipboard/prompt workflow. The helper keeps the existing report
URL, title, fallback order, and user messages; the dialog's custom `onShare`
override remains first. Three tests cover each browser fallback and the encoded
URL. Independent review found no blocker. The full frontend test suite, focused
ESLint, typecheck, line-cap scan, diff check, and Next production build pass;
all 116 static pages generate. The inventory is 2,307 frontend files / 153,762
LOC / zero over 200. Production logic decreases by seven lines while the
registered regression tests add 60 lines; the frontend's 10,000–30,000 LOC and
API 100,000-line reduction targets remain unmet. A read-only audit also found
minor duplicate presentation branches in `RecentScans`, but its required
rendering test would outweigh the small production LOC savings, so it remains
an unimplemented optional cleanup.

The next frontend cleanup removed nine independently reviewed orphan files
(323 production LOC): an unused `404.tsx` that is not an App Router page, two
unreferenced helper/component pairs, and four unused components. The live
not-found, greeting, and mobile-navigation components remain. The default test
runner now registers two previously omitted readiness suites; their three
contract cases pass and test active `buildProductReadiness` usage. The full
frontend suite, typecheck, focused ESLint, line-cap scan, diff check, and Next
production build pass, generating all 116 routes. The inventory is now 2,298
files / 153,441 LOC / zero over 200. The 10,000–30,000 LOC frontend target and
100,000-line API reduction target remain unmet.

Two independently reviewed frontend cleanup slices removed 249 more orphaned
lines: the unmounted legacy dashboard management client, unused per-file CRUD
and link-update wrappers, and small unused UI/ID/cookie helpers. Active system
dashboard and management routes, live file-list/upload flows, and share-route
cookie behavior remain. No consumers or route/package registrations referenced
the deleted modules. The full frontend suite (including both newly registered
readiness tests), typecheck, line-cap scan, and Next production build pass; all
116 routes generate. Inventory: 2,289 files / 153,192 LOC / zero over 200. The
10,000–30,000 LOC frontend and 100,000-line API reduction goals remain unmet.

The 1,042-line Helpdesk access-recovery React tree was removed after two
independent reviews confirmed that no current route, import, dynamic load,
navigation action, or active test mounts it; the existing Helpdesk render test
already asserts the old controls stay absent. The current audit timeline and
separate user-admin impersonation UI remain. Backend recovery endpoints,
read-only readiness contracts, and their API tests were left intact. Full
frontend tests (including the explicit absent-UI check), typecheck, line-cap
scan, diff check, and Next production build pass; all 116 routes generate.
Inventory: 2,272 files / 152,150 LOC / zero over 200. This is a verified
feature-preserving reduction relative to the mounted product; the 10,000–30,000
LOC frontend and 100,000-line API reduction goals remain unmet.

Four more unused frontend utilities were removed (108 LOC): the old log merge
and service-name helpers, unused traffic-domain mapping, and unscoped thoughts
list fetcher. Independent review confirmed no imports, dynamic loads, barrels,
tests, scripts, routes, or package exports reference them; active log, traffic,
and workspace-scoped thoughts flows remain separate and unchanged. The full
frontend suite, typecheck, line-cap scan, diff check, and Next production build
pass with all 116 routes generated. Inventory: 2,268 files / 152,042 LOC / zero
over 200. The 10,000–30,000 LOC frontend and 100,000-line API goals remain
unmet.

The VM cleanup removes six unreferenced frontend fetch wrappers (286 LOC) whose
current pages use separate snapshot, telemetry, and user-scoped data paths. The
two agent-target API endpoints remain in the backend; only their unused
frontend wrappers and 35 lines of stale Playwright route mocks were removed.
The full default frontend suite, typecheck, focused ESLint, line-cap scan, diff
check, and Next production build pass with all 116 routes generated. The
separately gated Playwright project-flow journey was not run in this checkpoint.
Inventory: 2,262 files / 151,721 LOC / zero over 200. The 10,000–30,000 LOC
frontend and 100,000-line API goals remain unmet.

The seven TI selected-action panels now share one responsive title/action header
component. This removes 27 repeated JSX lines while retaining the same rendered
elements, class names, titles, actions, data hooks, and panel data derivation.
A registered server-render test locks the shared header markup. The focused test,
full default frontend suite, typecheck, focused ESLint, frontend 200-line scan,
and production build pass; all 116 routes generate. The frontend inventory stays
at 2,264 files / 151,721 LOC / zero over 200, so this is a reuse/readability
improvement rather than net LOC reduction. The frontend 10,000–30,000 LOC and
API 100,000-line reduction goals remain unmet.

The scanner and security-monitoring solution pages now share the exact feature
card presentation they previously defined twice. A server-rendered test checks
each page's three titles, descriptions, and article structure. The full default
frontend suite passed; the strengthened focused page test, typecheck, focused
ESLint, line-cap scan, and production build also pass, generating all 116
routes. Inventory: 2,266 files / 151,752 LOC / zero over 200. This small reuse
slice keeps page copy and layout stable; it does not materially advance the
10,000–30,000 LOC frontend or 100,000-line API reduction goals.

The 854-line `api/src/utils/systemCron.ts` is now an 18-line compatibility
facade over scheduler registry, inventory, projection, and control modules.
Independent review confirmed public exports, account-purge scheduling, cache
refresh behavior, and job controls are preserved. Two one-function projection
modules were consolidated; the largest new scheduler file is 164 lines. The
API typecheck, focused lint, 28 scheduler/account-deletion tests, and repository
line-cap scan pass; the PostgreSQL purge integration was skipped because its
test port was not configured. Repository inventory: 3,725 files / 320,022 LOC / 122
over 200 (all outside this area). The API 100,000-line reduction goal remains
unmet; this checkpoint primarily addresses modularity and the file cap.

The three TI workbench server loaders now share endpoint fetching, tenant,
timeout, cache, and failure handling while preserving case/delivery sorting.
Focused tests cover payload keys, request options, ordering, unavailable and
malformed responses, and sort failures. Independent review found and drove fixes
for malformed truthy payloads and null rows so both retain the former empty-list
fallback. The full default frontend suite, focused TI tests, typecheck, ESLint,
frontend cap, and production build pass; all 116 routes generate. Frontend
inventory: 2,267 files / 151,843 LOC / zero over 200. The helper removes repeated
production fetch code; added regression coverage means total frontend LOC rises
from 151,752. The 10,000–30,000 LOC frontend and 100,000-line API goals remain
unmet.

The API events handler was split along route, catalog, finding, storage, normalization, and Sigma responsibilities, leaving a 10-line compatibility facade and twelve modules under 200 lines. Utility callers now import the relevant modules directly, avoiding a handler-facade cycle. Independent review found no actionable behavior or export regressions. Focused API verification passed 221 tests / 996 assertions, with one PostgreSQL-gated test skipped; full lint/typecheck passed. This is a structural cleanup and adds some module-boundary LOC; it does not materially advance the 100,000-line reduction target.

The generated frontend search-route catalog now emits one route object per line (130 lines total) and remains exactly equivalent to the previous 127-route catalog. The 200-line checker now includes the generated catalog, and a generator-side guard rejects oversized output before cleanup or writes. Tests cover catalog aliases, exclusions, ordering, uniqueness, and line-cap rejection. Independent review found no actionable issue. Focused frontend tests (6), typecheck, targeted ESLint, deterministic regeneration, and frontend line-cap checks passed. The frontend cap scan now covers 2,269 files / 152,024 lines with zero over 200; its total includes the previously exempt generated file. The frontend remains far above the 10,000–30,000 LOC target.

After these checkpoints, the repository-wide line-cap scan reports 122 oversized handwritten files among 3,738 files / 320,187 LOC. The events handler no longer exceeds 200 lines, but the remaining repository-wide cap debt is substantial. The API 100,000-line reduction and frontend 10,000–30,000 LOC targets remain unmet.

At the current 2026-10-17 working-tree snapshot, the frontend-only scope contains
2,258 hand-maintained source/config files and 151,442 lines, with zero files
over 200 lines. This count excludes generated route/article catalogs and
dependency/build output. The strict frontend file cap is currently satisfied;
the much larger 10,000–30,000-line target remains unmet. Continue prioritizing
verified reuse and removal of truly duplicated or unreferenced implementation,
while preserving rendered UI, accessibility, routes, and every page's expected
data contract. The integrated API work is still in progress, so repository-wide
counts and the overall cap remain provisional.

Since that snapshot, three reviewed frontend reuse slices shared restore
polling behavior (+9 production LOC), consolidated password inputs across
login/signup/reset (+13), and shared the API-key card prop contract (-47).
Together these reduce production code by 25 lines. A separate reference audit
removed three unreferenced modules (171 LOC), taking the frontend inventory to
2,258 files / 151,429 LOC / zero over 200, down 171 lines from the preceding
snapshot. The Next production build generated all 116 routes; typecheck,
changed-file lint, cap checks, and seven dashboard navigation tests pass. The
API-key owner-picker Playwright check did not run because Playwright's managed
API server exited before browser startup. The 10,000–30,000-line target remains
unmet.

The latest integrated repository scan is 3,981 hand-maintained files / 322,199
LOC, with 112 files over 200 lines; the frontend has zero over-limit files.
The verification-jobs and organization utility extractions now preserve their
public contracts and pass focused tests/typechecks, but add roughly 45 and 808
LOC respectively while meeting the cap. A duplicate pair of API runner-policy
assertions was removed, and the public TI test now verifies selected route
quotas. These API checkpoints improve boundaries and test accuracy, not the
100,000-line reduction target. A shared TI workbench loader now filters
malformed non-record rows while preserving valid neighbors, preventing a null
alert from crashing the page. Six focused loader tests, typecheck, changed-file
lint, independent review, and the Next production build pass; all 116 routes
generate. Current integrated counts are provisional during continued refactors.

After commits `9caa494ae`, `c732c7ed4`, `f5b5dff1a`, `207127567`, and
`67fbb83a8`, the frontend cap scan covers 2,274 files / 152,066 LOC / zero over
200. The full frontend suite and production build pass; all 116 routes generate.
The browser source-contract aggregation follows the extracted WS and onion
session modules. Restore feedback reuse and traffic response validation preserve
the existing UI and data behavior. The frontend inventory is 43 lines above the
preceding 152,023-line scan, so the 10,000–30,000 LOC target remains unmet.

The WS plugin is now a 106-line facade with 13 responsibility modules, all at
or below 197 lines. Their combined implementation is 66 lines larger than the
former 1,277-line file. Independent review and 18 focused tests / 56 assertions
passed, along with API typecheck/lint and both source-contract smokes. The admin
support access-recovery approval readers now share a query projection, removing
23 production lines while retaining `FOR UPDATE` only on the locked query and
excluding its audit projection. Its 17 focused tests / 153 expectations,
typecheck, lint, and independent review pass. Traffic records now validate
integer totals on initial, paginated, and live-snapshot reads before mutating
page state; focused guard tests and independent review pass.

The current repository-wide scanner reports 3,996 hand-maintained files /
322,310 LOC, with 111 files over 200 lines, all outside the frontend. The
frontend cap is satisfied, but the API 100,000-line reduction and frontend
10,000–30,000-line targets remain unachieved. These commits are local and
unpublished; remote publication is still pending authorization.

After `b65075f43`, `c095544ac`, and `a2e1c5985`, the frontend still passes its
hard cap: 2,274 hand-maintained files / 152,060 LOC / zero files over 200 lines.
The browser route now shares its one-second run-clock interval, removing 6
production lines while preserving the timer activation conditions and cleanup.
The API Public TI test suite was split into six focused suites and a shared
fixture helper; its 27 tests / 334 assertions pass through the registered test
runner. An independent review found and fixed a missing runner-policy update
before commit. The automation utility is now a small facade plus 12 modules;
the extraction adds 45 LOC, but each module stays below 200 lines and focused
tests, typecheck, lint, and independent review pass. Its database-gated history
test remains unrun because the configured test database is unavailable.
Two more reviewed frontend reuse slices now share audit-acknowledgment request
handling between Helpdesk and Management, and render four identical browser
evidence cards through one local component. They preserve request contracts,
error behavior, and exact card markup. The frontend suite passes, the production
build generates all 116 routes, and the cap still passes at 2,276 files /
152,103 LOC / zero over 200. The new tests account for most of the LOC increase;
production code is approximately unchanged. Repository-wide scan: 4,016
hand-maintained files / 322,421 LOC, with 109 over 200 lines, all outside the
frontend. Frontend size remains far above 10,000–30,000 LOC; the API reduction
target remains unmet. Local branch is 31 commits ahead of `github/main`; no
remote publication was performed.

The latest API slices moved four former over-cap files (AI project builder,
impersonation, AI economics, and admin inspection packets) into responsibility-
based modules while preserving compatibility exports. Characterization tests,
route tests, and SQL parameter/order checks pass; each touched module is <=200
lines. Structural extraction adds roughly 124 production lines in aggregate,
so this work improves boundaries and readability rather than achieving the
100,000-line reduction goal. A duplicate unreachable AI project-builder rule
and single-use helpers were removed; output hashes and key generated paths are
covered. Frontend cap remains zero violations at 2,276 files / 152,103 LOC,
and its full test suite and production build (116 routes) passed. The repository
scan is 4,055 files / 322,580 LOC with 105 over 200, four fewer than the earlier
109-file scan; all frontend files pass. Branch is 36 commits ahead of
`github/main`; changes remain local and unpublished.

At `39d3382c9`, the two traffic screens now share the same delayed snapshot
polling lifecycle, including retry, cache policy, and stop-during-request
behavior. Screen-specific response validation and state updates remain in each
consumer. The two consumers shrink from 285 to 252 lines; the shared helper is
39 lines, so production code totals 6 lines more across these three modules. A
focused 83-line test covers polling success,
failure/retry, preservation of last-good data, and cleanup. The full frontend
suite passed, and the production build compiled and generated all 116 routes.
The frontend hard-cap scan reports 2,278 hand-maintained files / 152,193 LOC / 0
over 200 lines. This is a structural reuse improvement, not a meaningful net LOC
reduction: frontend size remains above the 10,000–30,000 goal, and the API
100,000-line reduction remains unmet. Continue prioritizing measured duplicate
removal alongside natural component reuse; retain UI, accessibility, routes,
and page data contracts.

After commits `fd815bb04`, `85abc0940`, `f92161de2`, and `c9fbae0db`, the
frontend reuses a shared findings-workflow action lifecycle, password-action
hook, article/thought create editor, and share-route preference parser. The TI
workbench case and alert adapters now share only their identical severity and
pluralization helpers; their distinct mapping behavior remains separate. Direct
tests cover workflow failure cleanup and side effects, editor rendering, route
data contracts, and case adaptation. Independent review found no actionable
behavior or UI regressions. These changes remove about 57 production lines in
aggregate while adding focused tests and runner entries. The default frontend
test suite, changed-file ESLint, TypeScript check, and production build passed;
the build generated all 116 routes. Repository-wide ESLint still reports 1,612
findings, while all changed files pass targeted lint. The latest frontend scan
is 2,288 candidate source/config files / 152,695 LOC / zero over 200 lines. The
increase of 502 LOC from the prior snapshot is mostly characterization and
regression coverage, so the 10,000–30,000 frontend target remains far from met;
the API 100,000-line reduction is also outstanding. Branch `main` is 47 commits
ahead of `github/main`; these checkpoints remain local until the complete
integrated request is ready for publication.

The following frontend test review removed two duplicate scenarios and merged
the useful DWM case-detail source assertions into its registered unit check;
the redundant source-only Playwright spec is gone. Separate Share Chat workflow
tests remain, but their synthetic mocked prompt matrices now keep 42 of 420 rows
(−378 LOC), with one ordinary and one edge prompt per matrix. Independent review
found and fixed an ID-parity gap so screenshot-present and screenshot-absent,
issue-present and issue-absent states remain represented. A renderer test for
the three TI workbenches now covers their existing selection preview, empty
states, row highlights, links, and actions. A proposed shared shell was rejected
because it would add 38 production LOC and require configuration without enough
reuse. The default frontend suite, focused tests, scoped ESLint, typecheck, and
line-cap check pass. Browser tests are not fully verified here: Chromium launch
is denied by the environment, and the authenticated provisioning server exits
before its browser test starts. The current cap scan is 2,288 files / 152,381
LOC / zero over 200, a 314-line reduction since the previous 152,695-line scan.
Handwritten `src` remains about 114,052 LOC and tests about 26,830 LOC. The
10,000–30,000 frontend target and API reduction goal remain outstanding; these
test cleanups do not establish a 100k-line reduction path.

Commit `04ddd9952` centralizes the invariant metadata for six product-progress
readiness lanes. Their constructors fall from 342 to 285 production lines
(−57); status-specific wording, probe hints, row IDs, routes, and schema/proof
versions stay explicit and are directly asserted. The complete default frontend
suite and production build pass; all 116 routes generate. The latest 200-line
scan covers 2,290 files / 152,423 LOC / zero violations. A TypeScript/JavaScript
inventory counts 111,885 LOC in `frontend/src`, 26,927 in `frontend/tests`, and
10,292 in `frontend/scripts`; configuration and other source files make up the
remainder. The API survey counts `api/src` at 102,747 LOC / 1,114 files, so a
100,000-line reduction would leave about 2,747 lines for the entire API. The API
test tree is 37,392 LOC / 411 files (32,919 LOC across 349 direct test suites);
the reviewed support and webhook suites cover distinct access, audit, and
lifecycle contracts, not wholesale redundant functionality. Existing product
and support invite/member flows already share their underlying domain writes.
The measured evidence does not support either the frontend 10,000–30,000 target
or the API 100,000-line reduction without broad feature removal; continue with
verified, bounded quality improvements and preserve all route/data/UI contracts.

The current frontend slice centralizes the exposure-queue fetch/202/normalization
contract used by the homepage and Activity page, shares the article/thought
publishing empty-state shell while passing through their exact distinct actions,
and extracts the common project/share deletion lifecycle without merging their
endpoint or error policies. Focused tests cover the request contract, empty
state rendering, and deletion outcomes. The independent review found no UI or
API behavior regressions; the deletion-hook tests exercise its outcome boundary,
while existing browser coverage is not rerun here. The registered full default
frontend suite passes, the production build and TypeScript pass with all 116
routes generated, and scoped ESLint passes. The latest cap scan covers 2,295
files / 152,553 LOC / zero over 200 lines. That is 130 LOC above the preceding
152,423 scan, so these structural changes improve reuse and testability but do
not demonstrate net size reduction. Repository-wide ESLint debt and the wider
frontend/API size goals remain outstanding; no push or deployment was performed.

The next frontend reuse slice now shares organization member/invite filter
controls and their responsive layout while leaving each page's filtering,
options, counts, clear-state logic, and data intact. Helpdesk and Management
share acknowledgment pending/error/request lifecycle; their distinct event field
mappings and copy remain in their own adapters. The previously unregistered
audit acknowledgment transport test and the new lifecycle/render tests are now
in the default runner. Independent reviews found no UI/data behavior regressions;
the acknowledgment unit tests cover state transitions and field updates but do
not mount the React hook to exercise its in-flight guard. The registered full
frontend suite passes, production build/typecheck pass, and all 116 routes
generate. Scoped ESLint and the 200-line scan pass: 2,299 files / 152,769 LOC /
zero violations. That is 216 LOC above the preceding 152,553 scan, primarily
because the characterization and lifecycle tests were added; this is verified
reuse work, not net size reduction. The organization browser E2E attempt stopped
before test startup because the configured local API server exited with code 1.
Do not claim those browser interactions were verified here. No push or deploy.

The browser history screens now share their DELETE request construction and
response/error parsing while retaining distinct callers' success and refresh
effects; an explicit empty ID list remains different from omitted IDs (clear
all). Share `WorkspaceStatus` now reads Git state through the Git plugin's
existing local-storage parser, removing the duplicate parser while preserving
its canonical-share/route-ID lookup order, storage listener, and markup. New
browser request and storage-reader tests are registered in the default runner.
The shared reader test covers SSR, absent, malformed, incomplete, and normalized
values. Independent review found no behavior regressions. Full frontend tests,
scoped lint/typecheck, and production build passed; all 116 routes generated.
The current scan is 2,302 files / 152,836 LOC / zero files over 200 lines, up 67
LOC from the prior scan; the additions are test coverage and do not show net
frontend size reduction. TS/JS inventory is about 111,974 LOC under `src`,
26,879 under `tests`; the largest reviewed dashboard area is TI at 7,355 LOC
across 82 files, and `components/share` is 8,105 LOC across 97 files. These are
directory counts, not a complete feature-by-feature attribution. The 10,000–
30,000 frontend target and broader API goal remain unfinished. No push/deploy.

After `1da2a36cc`, `daf335a20`, `0088926d8`, and `a4c2f3af9`, the frontend cap
scan covers 2,308 hand-maintained source/config files / 153,054 LOC with zero
files over 200 lines. The UI remains unchanged: container row/detail actions
share one presentation component, and findings/rules share a small case-
insensitive search predicate while retaining their distinct trim behavior. TI
workbench reference-list merging is local to its adapter and preserves existing
coercion/order semantics. The stale mail E2E task pointing to a deleted test was
removed. Seven top-level-assertion files now report named Bun tests; independent
review confirmed their assertions and cleanup remain active. Focused checks,
scoped ESLint/typecheck, the full frontend test runner, and production build
passed; all 116 routes generated. These are quality/coverage improvements, not a
size reduction: the latest total is 218 LOC above the preceding frontend scan,
largely from new contract tests. The 10,000–30,000 frontend target and broader
API reduction remain unmet; the current evidence does not support that target
without feature loss. No push/deploy was performed.

After `a3cd240ef`, service-account API calls reuse the existing backend auth
header builder; the old endpoint, method/body forwarding, forced no-store cache,
header replacement, and missing-cookie values are covered by the existing
registered request-contract test. Peer review found no behavior change. The
full frontend suite, production build/typecheck and all 116 route generations
pass. The latest frontend cap scan covers 2,308 files / 153,097 LOC / zero over
200. The new contract test outweighs the two production lines removed, so this
checkpoint is not a net frontend size reduction. No push/deploy was performed.

The four TI workbenches that used the same selected-row initialization, stale
selection reset, and row fallback now share `useSelectedWorkbenchRow`. An
independent review confirmed the hook and each consumer preserve selection,
callbacks, markup, keyboard behavior, and data fallbacks. Focused workbench
tests, scoped lint, typecheck, and the frontend cap pass; the focused tests do
not yet exercise row selection disappearing during a mounted session. The
frontend scan now covers 2,308 files / 153,090 LOC with zero files over 200.
This exact reuse removes seven production lines, but the 10,000–30,000 LOC
frontend target remains unmet. No push/deploy was performed.

The API deployment route now delegates access/repository lookup, execution,
retry, and release persistence to cohesive modules; independent review found
validation and authorization order, bridge/event ordering, SQL values, and
response contracts unchanged. Its five files stay below 200 lines. The 504-line
rule-editing suite is now six registered suites plus one fixture, preserving 32
tests / 206 runtime expectations; the 466-line verification-jobs suite is now
177 lines with cancellation/database/state fixtures, preserving 15 tests / 77
expectations and the held-fetch cancellation guarantees. Independent reviews
approved both test splits. Organization privacy state reads now live in a
separate query/read-model module; its focused tests and API typecheck pass, and
the TI client/export call paths were left in place. The repository-wide scan
now reports 101 / 4,109 files over 200 lines and 323,714 LOC; three oversized
files were resolved, but module/test boundaries increased aggregate LOC by
about 110 from the preceding scan. Frontend remains at 2,308 files / 153,090
LOC / zero over cap. The API 100,000-line reduction and 10,000–30,000 frontend
target remain unachieved. No push/deploy was performed.

The API key helper is now an 18-line compatibility facade over focused policy,
query, authentication, scope storage, record mapping, and credential modules.
Independent review confirmed exported API, SQL/parameter ordering, secret
format/hash, scope matching, and failure cleanup remain unchanged. The existing
API-key, service-account-scope, and public-TI suites pass (12 tests / 92
expectations). The account deletion flow already schedules a purge at the
30-day deadline through the minute cron; the worker checks due status and
rechecks eligibility before deleting. Its scheduler test was split under 200
lines without changing behavior, preserving two scenarios / 32 expectations.
The indexed scheduler test and scheduled-job registry check pass; the optional
PostgreSQL purge test could not run because no disposable DB port is configured.
The latest repository scan finds 99 / 4,116 files over 200 lines and 323,651
LOC; the frontend remains 2,308 files / 153,090 LOC / zero over cap. No API
100,000-line or frontend 10,000–30,000-line reduction has been demonstrated.
No push/deploy was performed.

Reviewed follow-on splits now put share routes, automation routes, and the
security web scanner under the 200-line cap while retaining their public
exports. Peer reviews found the auth/owner/tree/mutation contracts, automation
quota/run/history behavior, and HTTPS/redirect/lock/persistence behavior
unchanged. Focused checks passed: share 11 tests / 88 assertions, automation
persistence 13 / 50, web scanner 10 / 32. Automation history integration could
not reach its `monitor-test-db` hostname; the default full API runner excludes
that database-dependent suite. After these changes, full API lint/typecheck and
the default registered API test runner pass. The global line-cap report is 93 /
4,145 files over 200 lines and 323,749 LOC, 34 lines above the previous scan
from module overhead. Frontend remains 2,308 files / 153,090 LOC with no files
over the cap; its full test suite and production build already pass. The large
API and frontend reduction targets remain unmet. No push/deploy was performed.

Three more API handlers now meet the cap through reviewed responsibility
boundaries: AI tools (prompt flow, transport, policy, model/retry and accounting),
public TI (auth, collections, projections and errors), and browser sandbox runs
(history, lifecycle, reports, identity/quota). Independent reviews found their
auth, billing, event, pagination, websocket and response contracts unchanged.
The global API `bun run lint` and default `bun run test` both pass; the runner
explicitly excludes 37 database-required suites unless their test environment
is configured. The frontend full suite and production build/typecheck pass, all
116 routes generate, and its cap scan remains 2,308 files / 153,090 LOC / zero
over. Repository cap currently reports 96 / 4,133 files over 200 lines and
323,715 LOC. The three source extractions added about 64 aggregate LOC while
bringing three files under the cap. This improves ownership but does not move
toward the 100,000-line API or 10,000–30,000-line frontend reduction targets.
No push/deploy was performed.

At the 2026-10-17 integration checkpoint, traffic handlers were split into
focused analytics, records, live-stream, query, request, and warm-up modules;
the facade preserves its 11 original exports. Route registration is split into
five ordered modules covering all 323 direct registrations, and the global
type declarations are split into seven script-style ambient declaration files
with all 57 type bodies unchanged. Organization-retention helpers were also
extracted while keeping the export and TI request bodies byte-for-byte intact.
Independent reviews approved these changes. API lint/typecheck and the default
registered API suite pass; the API runner explicitly excludes 37 database
suites. Frontend audit status classification now reuses one predicate across
metrics and row styling, removing four production lines. Static frontend
contracts were updated to inspect the new API route/handler owners without
weakening their assertions. The full frontend suite and production build pass,
with all 116 routes generated. The frontend cap scan reports 2,308 source/config
files / 153,101 LOC / zero over 200. The repository-wide scan reports 89 of
4,167 hand-maintained files over 200 lines and 323,844 LOC total; none of the
remaining over-cap files are in the frontend. Module boundaries and added test
assertions leave aggregate LOC higher by about 10 lines in this checkpoint.
The 100,000-line API and 10,000–30,000-line frontend reduction targets remain
unachieved. No deployment was performed.

The next reviewed checkpoint separates Stripe webhook transport and event
mutations from the billing facade; the original public webhook/signature
exports remain, and independent review confirmed validation, idempotency,
transaction and SQL ordering are unchanged. The focused Stripe suite passes
(7 tests / 19 assertions), and API lint/typecheck plus the full default API
runner pass. The API runner still skips 37 database-required suites. On the
frontend, notes, automation, system-cron and apt-update clients now share
`backendJsonRequest` while keeping their domain paths, auth policy, response
fallbacks, cache behavior, cookie refresh, abort signal and apt headers. The
four clients plus helper are 326 LOC versus 324 before; focused coverage is
four tests / 38 expectations. Independent review approved the transport. The
full frontend suite, typecheck and production build pass, with all 116 routes
generated; its cap scan covers 2,309 source/config files / 153,185 LOC / zero
over 200. The repository-wide scan finds 88 of 4,170 files over 200 lines and
323,940 LOC total. The API 100,000-line and frontend 10,000–30,000-line targets
remain unachieved. No deployment was performed.

At the next integration checkpoint, three API production modules were reduced
below 200 lines through reviewed responsibility boundaries: browser-task
analysis (content extraction and quality diagnostics), commercial-contact
persistence/notifications, and profile SSH-key reads/projection. Independent
reviews found public exports, SQL/query order, limits, authorization, rollback,
cache invalidation, audit, and response contracts preserved. Focused tests and
API lint/typecheck passed; the full default API runner also passed, while its 37
database-required suites remain excluded. The frontend TI action-items table
now reuses the existing dashboard panel/table frame; its row/data mapping,
sort/order, caps, links, badges and empty-state copy stay in feature code. An
independent render review approved unchanged markup and contracts; its focused
render suite, full frontend suite, typecheck, and production build passed, with
116 routes generated. The frontend cap scan now covers 2,309 files / 153,229
LOC / zero over 200. The repository scan reports 85 of 4,174 files over 200
lines and 323,995 LOC total: three API violations were resolved, while module
and test boundaries added about 55 aggregate lines. The API 100,000-line and
frontend 10,000–30,000-line size goals remain outstanding. No deployment was
performed.

The next checkpoint splits host SSH key normalization and SSH transport from
the existing compatibility facade, keeping public exports and transport
semantics stable while deriving the embedded Python algorithm allowlist from
the TypeScript source. It also centralizes the repeated passkey proxy JSON
response handling without changing route-specific auth, URLs, methods, request
bodies, or cache policy. Independent review approved both refactors. API lint,
typecheck, and the full default API suite pass; 37 database-required suites
remain excluded. Frontend typecheck and the full suite pass, and the production
build generated all 116 routes. The frontend cap scan covers 2,311 files /
153,312 LOC with zero files over 200 lines. The repository scan reports 84 of
4,178 hand-maintained files over 200 lines and 324,095 LOC total. The 100,000-
line API and 10,000–30,000-line frontend targets remain outstanding. No
deployment was performed.

The AI runtime endpoint now uses a focused snapshot loader instead of building
the full workspace bundle: its data path makes two owner/collaborator-filtered
queries and reuses those query helpers in the full workspace path. Independent
review and parity coverage approved conversation ordering, archived/shared
selection, access, message errors and tool state; API lint/typecheck and targeted
tests passed. On the frontend, four TI workbench panels now share their
responsive frame and selected-preview layout while retaining their own row,
detail and action logic. Independent render/interaction review approved the
unchanged UI contracts. The shell improves reuse but adds 25 production lines;
its expanded tests add 26 lines. The full frontend suite, typecheck, and
production build pass, with all 116 routes generated. Frontend cap scan: 2,312
files / 153,363 LOC / zero over 200. The Git input parser and workspace
helpers are also split from their route modules; the two original modules
shrank by 340 lines and the two helpers add 345, for five net lines, while
resolving two over-cap files. Their focused tests, API lint/typecheck, and
independent review pass. Repository scan: 82 of 4,184 hand-maintained files
over 200 lines, 324,289 LOC total. The API 100,000-line and frontend
10,000–30,000-line targets remain outstanding. No deployment was performed.

The next checkpoint decomposes passkey handlers into registration,
authentication, and support modules; password-reset handlers into code-flow,
security-action, and support modules; and AI workspace orchestration into auth,
queries, projections, and bundle modules. Existing route/export names and handler
behavior were preserved and independently reviewed. The new password-reset
code-flow test verifies that the emailed code equals the plaintext passed to
hashing, in addition to checking the stored hash and verification-token
exchange. The full default API runner passed all 329 registered suites (37
database-required suites are excluded); the updated password-reset focused test
also passed. API lint/typecheck and focused passkey/AI suites passed. All new
modules are under 200 lines. Repository cap scan is now 79 of 4,195
hand-maintained files over 200 lines / 324,479 LOC; frontend remains at 2,312
files / 153,363 LOC / zero over 200. The 100,000-line API and 10,000–30,000-line
frontend goals remain outstanding. No deployment was performed.

This checkpoint brings the rate-limit plugin/config, WebAuthn utility, and
onion-session restart tests under 200 lines through responsibility-based
splits. The rate-limit static contract now checks the policy module that owns
the browser-stream exemption; WebAuthn and onion-session tests are registered
with the isolated API runner. The test split preserves all 13 original
assertions, and the reset-code test verifies email/hash input equality. Focused
independent reviews approved these changes. The full default API suite passes
all 331 registered behavior suites (37 database-required suites remain
excluded); API lint/typecheck pass. Frontend full suite/typecheck/build pass
with all 116 routes generated, and its 2,312-file / 153,363-LOC cap scan has
zero over-limit files. Repository scan: 75 of 4,208 hand-maintained files over
200 lines, 324,593 LOC total. No deployment was performed; API 100,000-line
and frontend 10,000–30,000-line size targets remain outstanding.

A hand-maintained Chromium seccomp profile was reformatted into readable,
compact syscall rules without changing its parsed JSON. The current profile is
142 lines (previously 884); parsed equality against `HEAD`, consumer loading,
and `git diff --check` passed. Repository cap scan is now 74 of 4,208 files over
200 lines / 323,851 LOC total. Frontend remains at 2,312 files / 153,363 LOC
with zero over the 200-line cap. The frontend size target and broader API LOC
reduction goal remain outstanding. No deployment was performed.

Frontend reuse checkpoint: the load-testing table now uses the existing
`DashboardTablePanel`; optional class overrides preserve its exact previous
server-rendered markup and classes. The feature file drops 7 lines while the
shared primitive gains 8, for +1 LOC. Findings and TI webhook delivery now share
a focused POST/JSON/error helper, and the unused Findings parser was removed;
feature-specific tenant scoping, endpoints, action bodies, refreshes, and result
messages remain in their hooks. Independent review found no regression. The
helper plus focused tests and runner registration add 46 net lines; this is a
cohesion improvement, not a size reduction. Frontend full tests, typecheck,
production build (116 routes), targeted ESLint, and line-cap check pass. Full
frontend ESLint still reports 1,612 errors across existing unrelated files.
Frontend inventory: 2,314 files / 153,410 LOC / zero over 200. Repository cap
scan: 74 of 4,210 files over 200 / 323,898 LOC total. The 100,000-line API
reduction and 10,000–30,000-line frontend target remain outstanding. No
production UI or data contract changes were intended, and no deployment was
performed.

A second frontend reuse pass extracted table markup into `DashboardTable`, used by
TI activity, load-testing and both database-backup tables; exact server-rendered
classes/DOM, column order, wrappers, empty rows and pagination placement were
compared. Those five files add 10 LOC overall. Share's recursive file tree now
uses a scoped context for the callbacks/state previously threaded unchanged
through each node, preserving per-node file/tree props; that six-file production
refactor removes 16 LOC. Static review approved it and the Share tree-path test,
targeted ESLint/typecheck and cap passed. Its focused browser action test could
not start because the configured local API process exited before assertions.

The DWM delivery tests now exercise runtime summaries, rendered delivery states,
scoped request bodies, refresh/navigation outcomes and the public-advisory
case-handoff dry-run contract. Duplicate delivery source-string checks were
removed; unique operator copy/scope checks remain, and stale source assertions
were updated to current ownership. Independent review found no coverage loss
after restoring a runtime test for the dry-run case path. These three test files
grow from 168 to 311 lines (+143) and remain under 200 each. The full frontend
suite passed; focused Playwright tests passed 4/4; production build/typecheck
passed and generated all 116 routes. Frontend inventory is 2,314 files /
153,547 LOC / zero over 200. Relative to the prior checkpoint, the frontend
adds 137 LOC overall (the production changes net -6; stronger tests add 143).
The repository cap scan reports 74 of 4,210 files over 200 / 324,035 LOC total.
Full frontend ESLint still reports 1,612 existing errors across the repository;
all files changed in this checkpoint passed targeted ESLint. No deployment was
performed. The 100,000-line API and 10,000–30,000-line frontend targets remain
outstanding.

The organization alert-readiness smoke journey was split from its 803-line
entrypoint into a 70-line orchestrator and eight assertion/context modules. The
new modules preserve the original request and assertion order, all 691 assert
calls and 19 tenant identity checks; independent review found no behavior gap.
The organization smoke, API lint/typecheck and repository cap scan passed. The
split adds 87 lines for clearer responsibility boundaries; it is not an LOC
reduction. Commit `6433722f4` was pushed to both configured remotes.

The latest frontend reuse checkpoint centralizes recursive Share workspace-tree
walking and removes the duplicate AI walker, while preserving search root
stripping, tree counts and the old empty-folder path behavior. Nested path/count
regressions are covered. Two TI timeliness tables now use the shared
`DashboardTable` while retaining their exact rendered DOM, including an absent
`tbody` class. Independent review approved the frontend changes. Focused Share
tests (11 tests), changed-file ESLint, typecheck, and the frontend cap pass. The
frontend diff is +2 net lines including new tests; inventory is 2,313 files /
153,549 LOC / zero over 200. The repository scan is 73 of 4,217 files over 200
/ 324,124 LOC total. Commit `3058d9a1c` was pushed to both remotes. A broad
dashboard render proof could not connect to its configured local server at
`127.0.0.1:3010`; exact server-rendered table comparison passed separately. Full
frontend ESLint still reports 1,612 existing errors across unrelated files.
The 100,000-line API and 10,000–30,000-line frontend reduction targets remain
unmet. No deployment was performed.

The subsequent frontend components reuse the organization filter strip for
watchlists, share table wrappers between VM/container inventory and cases/DWM
delivery views, reuse the shared TI `StatusPill` for enrichment, and collapse
duplicate Recent/All article grids into one private `ArticleGroup`. Watchlist
filters preserve labels, markers, counts, disabled state, status values and
clear behavior; article sections preserve their headings, slicing and order.
Independent reviews approved exact SSR output for the dashboard tables, TI
status pills and article sections. Production code across commits `f23f149fd`
and `e88ad9326` is down 18 lines; new tests add 67 net lines. The frontend full
test runner passed and the production build generated all 116 routes. Targeted
ESLint, typecheck and the 200-line scan passed; frontend inventory is 2,315
files / 153,598 LOC / zero over 200. The repository scan remains 73 of 4,219
files over 200 / 324,173 LOC. Both commits were pushed to the configured
remotes. A separate visual dashboard render proof could not connect to its
local server, so no visual-runtime pass is claimed. The full frontend ESLint
baseline remains 1,612 errors across unrelated files. The API and frontend LOC
reduction targets remain outstanding; no deployment was performed.

The frontend test checkpoint replaces a stale source-slicing AI chat theme
spec with registered Bun server-rendered assertions for composer accessibility,
header and artifact theme tokens, verification diagnostics, and transcript
errors. TI theme assertions now cover actual rendered activity and delivery
states, including populated and no-latest-run data, while retaining the unique
enrichment source contract. Independent review approved the changes. The full
frontend test runner and typecheck passed; focused ESLint, changed-file line cap,
and `git diff --check` passed. Frontend inventory is 2,315 files / 153,659 LOC
with zero files over 200 lines. The broader API 100,000-line reduction and
frontend 10,000–30,000-line targets remain outstanding. No UI change or
deployment was made.

The latest frontend checkpoint consolidates shared AI workspace primary
actions, case-detail URL construction, backup/restore evidence rows, TI status
pills, case timestamps, rate-limit field labels, and AI workspace file-selection
metadata. Runtime tests cover rendered variants, URL query serialization,
evidence layouts, timestamps, rate-limit controls, and selected-file metadata.
The stale unregistered AI workspace theme source scan was replaced by rendered
SSR assertions; a failed Import assertion was corrected to render the actual
`WorkspaceImportPanel`. The full frontend test runner, typecheck, targeted ESLint
for all changed files, line-cap scan, diff check, and production build pass; the
build generated all 116 routes. All 2,319 frontend source/config files fit the
200-line cap at 153,863 total lines. Production code is down 34 lines, while
tests and scripts add 143, for a net increase of 109 lines in this batch; the
frontend is 204 lines above the prior 153,659-line snapshot. This is a reuse and
test-quality checkpoint, not progress toward the 10,000–30,000-line target.
The repository-wide scan reports 73 of 4,223 hand-maintained files above 200
lines and 324,438 total lines. The API 100,000-line and frontend
10,000–30,000-line reduction goals remain unmet. Existing full-frontend ESLint
baseline errors outside this changed-file check remain. No deployment was
performed.

A follow-up frontend pass replaces CaseOverview source-slicing assertions with
SSR checks for empty/populated rows, headers, organization-specific links, and
the view/API wiring boundary. A shared vulnerability timestamp formatter now
owns the identical valid/invalid-date guard in both scan summary consumers;
their Norwegian locale, caller-specific fallbacks, paused state, and image prefix
remain unchanged. The focused test is registered and covers valid, missing, and
invalid timestamps. Independent review approved both changes after restoring
the workflow-boundary and fallback assertions. The full frontend test runner,
typecheck, changed-file ESLint, line-cap scan, diff check, and production build
pass; all 116 routes were generated. The frontend inventory is 2,320
hand-maintained files / 153,920 lines / zero files above 200. The helper removes
five production lines; the current inventory is 57 lines above the prior
checkpoint, mostly from stronger runtime coverage. The repository-wide scan is
73 of 4,224 files over 200 / 324,495 total lines. API 100,000-line and frontend
10,000–30,000-line reduction goals remain unmet. No deployment was performed.

A registry audit found two meaningful Bun SSR tests missing from the default
frontend runner: exact custom-prop `DashboardTable` DOM contracts and the shared
TI `StatusPill` compact/default markup contracts. Independent review confirmed
they complement existing coverage rather than duplicate it, so both are now
registered. The full frontend suite passes with those cases included. The
inventory is 2,320 hand-maintained files / 153,922 lines / zero over the 200-line
cap; the repository scan is 73 of 4,224 files over 200 / 324,497 total lines.
No production code changed in this checkpoint. API 100,000-line and frontend
10,000–30,000-line reduction goals remain unmet. No deployment was performed.

The next frontend pass consolidated impersonation-reason normalization across
the UI counter, submission validation, and request client, and shared TI
enrichment-gap token matching while retaining separate source projections.
Independent review approved both changes. The full registered frontend suite,
focused runtime tests (3), typecheck, targeted ESLint, changed-file 200-line
scan, and `git diff --check` pass. The frontend inventory is 2,322
hand-maintained files / 153,984 lines / zero over 200. The production diff is
net +2 lines while removing duplicated normalization and matching rules; tests
and registration bring this checkpoint to +62 frontend lines overall. No UI
or data contract changed. The frontend 10,000–30,000-line goal and API
100,000-line reduction goal remain outstanding. No deployment was performed.

The AI workbench now uses one `newestConversationMessage` selector for tool
state and failure summaries; ordering, including equal-timestamp tie behavior,
is covered by the registered runtime test. Independent review approved the
change. Production LOC is unchanged; the test adds 43 lines and task
registration adds one. Focused tests, targeted ESLint, typecheck, line-cap scan,
and `git diff --check` pass. Frontend inventory is 2,323 files / 154,028 lines
with zero over 200. The 10,000–30,000-line frontend goal and API reduction goal
remain outstanding. No UI change or deployment was made.

The repository-wide 200-line cap work now addresses two API over-cap files. The
317-line support-session presentation module is split into five cohesive
modules totaling 311 lines (-6), with the original exports preserved. The
351-line TI scraper control test is split into auth/access, dashboard-read, and
control-action suites plus a shared fixture; independent review confirms its
assertions and cleanup contracts remain intact. Focused tests pass (16 tests /
69 expectations), the three runner registrations and runner-policy tests pass
(8 tests / 77 expectations), and API typecheck, targeted ESLint, and diff check
pass. Every changed file is under 200 lines. Other global cap violations and
the API/frontend LOC reduction goals remain outstanding. No deployment was
performed.

`api/src/utils/mail/stalwartAdmin.ts` is now a 13-line compatibility facade over
focused request, JMAP, principal, mapping, settings, and queue modules. The
complete implementation is 524 LOC versus 550 before (-26), and every module
is below the 200-line cap. Independent review confirmed exports, REST/JMAP
fallback order, retries, URL host handling, and principal mapping are
preserved. Its registered focused test passes (2 tests / 10 expectations), as
do API typecheck, targeted ESLint, and diff check. The global scan still
reports 69 other over-cap files. The API and frontend LOC reduction targets
remain outstanding; no deployment was performed.

Share search and symbol-reference panels now use one workspace-file indexing
hook. The panels retain separate filtering, result projection, debounce timing,
and component-local caches; their prior effects shrink by 4 net production LOC.
A regression test covers ambiguous filter-key separators, and the Playwright
scenario now persists mocked PUT results before checking symbols after
replace-all (3 references / 1 definition). Independent review approved the
hook and fixture. The full registered frontend suite, focused search tests (8),
typecheck, targeted ESLint, both frontend cap scans, and diff check pass; all
2,324 frontend files total 154,040 lines with zero over 200. Playwright could
not start the API because its database hostname failed DNS resolution, so no
browser-run result is claimed. The 10,000–30,000-line frontend and API LOC
reduction goals remain outstanding. No UI change or deployment was made.

Three reviewed API modules are now split below the 200-line hand-maintained file cap. The commercial lifecycle smoke keeps its disposable-database guard and 71 assertions; its modules total 811 lines versus 764 before, reflecting clearer lifecycle boundaries. The log-pipeline Postgres test split keeps all 137 assertions and safe database setup/cleanup; its modules total 851 lines versus 710 before. The Docker engine split keeps the compatibility export surface and behavior while separating transport, container, stats, and log responsibilities; files are 103 lines or fewer. API typecheck, targeted runtime tests, ESLint, and diff checks pass. The Docker response recovery test passes in isolation; its combined-run invocation exposed a test socket setup/order issue (EPERM) that remains to be investigated. Database smoke checks were not run because the required disposable database is not configured. The repository scanner still reports 67 over-cap files among 4,264 hand-maintained files (324,780 lines total); the frontend remains below the per-file cap at about 154,040 lines, so the frontend reduction goal and broad repository LOC reduction remain outstanding. No UI or deployment change was made.

Frontend account activity formatting now has one shared helper used by the sessions and passkeys panels. Both prior call sites used identical English medium-date/short-time formatting; the shared helper preserves the same `Date` conversion, default timezone, visible text, and markup. The production change removes one net line while eliminating duplicate behavior. A focused test is registered in the frontend product test runner. Independent review approved the extraction; the focused test, targeted ESLint, and non-incremental frontend typecheck pass. All touched frontend files are under the 200-line cap. The browser-history row candidate was deliberately left unchanged after review found its modal and embedded variants have meaningfully different links, selection, layout, and action contracts; a generalized component would not create net savings. Frontend LOC reduction remains far from the 10,000–30,000 target; this is a small reuse checkpoint, not evidence of broad reduction. No UI change or deployment was made.

The dashboard database summary and query disclosure now share the exact UTC sampled-time formatter. Both prior implementations used the same `en-GB` hour/minute formatting and ` UTC` suffix; the shared helper keeps the same input values, displayed text, markup, and page data flow. Production LOC is down by three. A registered deterministic test covers UTC output. Independent review approved the change; focused test, full frontend registered suite, ESLint, typecheck, and frontend line-cap scan pass. Frontend inventory is 2,331 source/config files / 154,095 lines / zero files over 200. No UI or page data contract changed.

TI workbench actions now share successful JSON response parsing/error handling across ten action call sites. This retains each call's former malformed-success `{}` fallback, API error-message precedence, status-text fallback, and readiness payload behavior; case/alert detail requests keep their distinct malformed-body messages. A registered four-case test covers success, malformed JSON, and both error sources. Production LOC is down by three; all touched files are below 200 lines. Independent review approved the change. Focused TI tests, full frontend registered suite, targeted ESLint, non-incremental typecheck, and frontend line-cap scan pass. No UI or data contract changed.

SSO start and callback routes now share one public redirect-policy helper, removing duplicated host/protocol selection and production internal-host canonicalization while preserving each route's provider-specific success/error flow and the callback's return-path/cookie behavior. Independent review confirmed first forwarded-host/proto values, fallbacks, and production canonical-host behavior are unchanged. Runtime tests cover forwarded headers and internal-host fallback; existing route-boundary coverage remains. Production LOC is reduced by about 20 lines; all touched files are below 200 lines. Focused suites, full frontend registered tests, targeted ESLint, non-incremental typecheck, and frontend line-cap scan pass. No UI or page data contract changed.

Five frontend modules that validate unknown JSON values now use one shared `isRecord` guard. The helper keeps the prior behavior exactly: accept non-null non-array objects, reject null, arrays, and primitives; `workflow-values.ts` continues re-exporting the public helper used by its callers. This removes six production lines and gives the shared contract a registered focused test. Independent review approved all five conversions and the export boundary. Focused test, targeted ESLint, non-incremental typecheck, and the frontend cap pass (2,333 source/config files / 154,100 lines / zero over 200). No rendered UI or page data contract changed.

Helpdesk audit timestamps and TI timeliness record dates now share one local date-time formatter. Both callers preserve their existing exported names, `Date` validity check, environment-local `toLocaleString()` output, invalid-value passthrough, and surrounding UI/data flow. Production LOC is down by three. The registered TI timeliness suite covers valid and invalid values through both aliases; independent review, focused tests, ESLint, typecheck, cap, and the production frontend build pass. No UI or page data contract changed.

Login and registration now share request-body parsing for form-urlencoded, multipart, and JSON requests while keeping their field mappings, validation, and auth redirects explicit. The shared helper preserves form redirect-path defaults, malformed JSON fallback, and existing JSON parsing exports. Two focused parser tests plus existing registered login/register route tests cover body formats and endpoint-specific mapping. Production LOC is down by 18. Independent review approved the change; focused auth suites, ESLint, typecheck, and frontend cap pass. No UI or page-data behavior changed.

The AI server page, workbench hook, and workbench state now share one `AIWorkbenchInitialData` type. The three prior field/optionality shapes match exactly; route-only `mode` stays explicit. SSR tests assert the complete loader payload reaches the client unchanged and retain the selected-conversation route assertions. Production LOC is down by about 30. Independent review approved the type and page-data boundary; focused SSR tests, ESLint, typecheck, cap, and the production build pass. No UI or loader data changed.

The frontend submit-button tests no longer duplicate the same actual form variants in a second standalone suite. The enabled-button-with-disabled-reason edge case was moved into the remaining variant suite; caller-specific submit type/labels/icons, standard and Telegram layouts, busy/disabled states, and reason titles remain covered by rendered consumers. Independent review approved the coverage comparison. The registered suite now passes 50 expectations; targeted ESLint, changed-file cap, and diff check pass. This removes 10 net test/runner lines without changing product code or UI.

A registered page-boundary contract test now exercises management users end to end from cookie-derived server loading through `Users` and `UsersList` to rendered organization links. It checks the no-store fetch arguments, active-current-user membership filtering, exact visible links, and the inactive-current-user empty-access path. Independent review approved the test; both focused cases, lint, typecheck, and the line cap pass. Product code and rendered UI are unchanged.

TI dashboard worker-state tone mapping is now shared across live operations, overview metrics, and activity. The three consumers had the same `active → ok`, `unavailable → bad`, other `→ watch` policy; the enrichment page keeps its distinct tone contract. Rendered labels/classes are unchanged and tests assert the mapping plus activity pill markup. Production LOC is down by three. Independent review approved the change; focused tests, ESLint, typecheck, and frontend cap pass. No page data or UI contract changed.

The four AI workbench hooks now use one `updateConversationState` operation to apply a functional conversation update and synchronize the live ref to that exact returned array. `usePromptActions` retains its separate immediate optimistic ref write and socket/persistence sequence. A registered test checks returned state, ref identity, and immutability. Independent review confirmed callback ordering and behavior; focused AI tests, ESLint, typecheck, diff check, and frontend cap pass. Production LOC is down by two; no prompt/UI/data contract changed.

The 715-line organization API smoke harness is now divided into state/row helpers and focused rule, organization, invite, member, and watchlist query modules, each no longer than 163 lines. All original SQL matchers and 46 nested/top-level predicates, fixtures, journey assertions, route order, and failure/cleanup behavior are preserved. Independent review approved the split; the direct organization smoke, API lint/typecheck, and diff check pass. Responsibility boundaries add 76 lines overall. The repository-wide scan still finds 66 other hand-maintained files over 200 lines; the frontend cap remains enforced and clean. No runtime product behavior changed.

On 2026-10-17, the TI run list's `shortDate` export was changed to alias the existing dashboard `shortTime` formatter, removing four production lines while preserving winter/summer Oslo output. Its registered formatter test (2 cases / 12 expectations), targeted ESLint, full frontend typecheck, and diff check pass. Commit `133cb24a4` is pushed to both remotes. A current repository scan reports 4,286 hand-maintained files / 325,023 lines, with 66 over 200 lines; no frontend file exceeds the cap. The frontend remains about 154,183 lines, far above the 10,000–30,000 target. The broad API and frontend LOC reduction goals remain unmet. No full frontend suite/build or deployment was run for this checkpoint.

At `5ee50b054`, the five VM detail cards now share a `VmPanel` shell, removing repeated wrapper/title markup and unused style/data props while preserving exact heading/wrapper output, card order, metrics states, and API-loaded children. Production LOC falls by seven; the registered SSR contract adds 15 test lines. Independent review approved the change. Focused VM tests pass (2/2), along with targeted ESLint, frontend typecheck, diff check, and the repository line-cap scan. The latest inventory is 4,287 hand-maintained files / 325,030 lines with 66 over 200; none are in the frontend, whose inventory is about 154,191 lines. The full frontend suite/build and the 10,000–30,000-line frontend and 100,000-line API reduction goals remain outstanding. The commit is pushed to both remotes; no deployment was performed.

At `eb58c66af`, the six GPT telemetry cards share one summary shell and the duplicated CPU/RAM sensor rows now use one component; GPU detail rows remain specialized. The server-rendered contract verifies card order/styles and summary values, then renders the actual expanded-detail component with CPU, RAM and GPU values. Production LOC falls by 17; test and registration add 50 lines. Independent review approved the changes. Focused GPT suites pass (4 tests / 24 summary expectations), as do targeted ESLint, frontend typecheck, line-cap and diff checks. The repository scan finds 66 of 4,286 hand-maintained files over 200 lines / 325,063 total lines; none are in the frontend, now about 154,224 lines. The frontend and API aggregate reduction targets remain unmet; no full frontend suite/build or deployment was run for this checkpoint. The commit is pushed to both remotes.

At `b3e14566d`, the full registered frontend suite passes. Static article/search generation and the Next production build pass, producing all 116 routes. I invoked the generators and Next build directly because the normal package build stops at the repository-wide line-cap precheck; that scan still reports 66 over-limit files, all outside the frontend. The frontend 200-line cap remains clean. No deployment was performed.

At `6d9b33e4b`, the TI timeliness queue now reuses its existing `ReportLookup` renderer instead of duplicating the block already used by record details, saving five production lines with identical display conditions. Its registered SSR test covers failed and running recovery states through both consumers, including exact formatted next-attempt output and its suppression while running. Independent review, focused tests (2 cases / 12 expectations), targeted ESLint, typecheck, diff check, and line-cap scan pass. The current inventory finds 66 of 4,287 hand-maintained files over 200 lines / 325,108 total lines; none are frontend files, whose inventory is about 154,269 lines. Aggregate reduction goals remain unmet. The commit is pushed to both remotes; no UI redesign or deployment was made.

The current frontend candidate keeps every hand-maintained frontend file under
the 200-line cap. A matching scoped inventory finds 2,331 files / 153,842 lines,
excluding generated article and search-route artifacts; the frontend cap scan
finds zero violations. Across the organization metadata badge and database
restore-action slices, production code is down eight lines total. The badge
centralizes the exact repeated span/class contract used by 16 organization UI
call sites. The restore clients now share their repeated action lifecycle while
preserving the distinct guards, arguments, immediate feedback reset, and router
refresh behavior. Independent review approved both changes. Registered focused
frontend suites pass (9 tests / 73 expectations), the restore source-contract
Playwright checks pass (2/2), targeted ESLint and TypeScript checks pass, and
every changed file remains at or below 200 lines. This modest production LOC
change does not materially advance the 10,000–30,000-line frontend objective;
the broad frontend and API reduction goals remain open. No UI, page data, or
deployment change was made.

The admin-support access-recovery inspection test now asserts the handler's
returned organization name and revoked-invite status instead of depending on
SQL projection strings. The removed projection checks remain covered by the
neighboring search and decision tests; the inspection test retains its actor
join and event-timeline checks. Independent review confirms the new assertions
match the response mapper. The two focused suites pass (7 tests / 38
expectations), as do targeted ESLint and diff checks. The test loses one line
and two implementation-coupled expectations while preserving its single case
and observable contract. No live API or database was exercised.

At `a96ac20fc`, identity session revocation distinguishes an authorized zero
session result from a service 401 and rejects malformed success bodies. Account
purge now records/retries an unconfirmed revocation before deleting credentials
or account data. Password reset and password-reset account lock roll back on
unconfirmed revocation; the same reset code and security-action link succeed
after revocation recovers. Independent review approved these changes. Focused
purge, session, password-reset, security-action, and scheduler tests pass; the
full API lint/typecheck passes. The commit is pushed to both remotes. No
deployment was performed.

The 319-line status handler is now split into a 145-line request/cache/history
entrypoint and a 176-line status payload loader. This responsibility split
adds two production lines. A registered 87-line behavior test now covers the
non-summary loader's sequential current-check, daily-history, and incident
queries and verifies the projected payload from fixed rows; it does not assert
SQL text. Independent review approved the extraction and test. The focused
status contract/cache/recovery/incident and loader tests pass, along with API
lint/typecheck and diff checks. The repo scanner finds 65 over-cap files among
4,291 hand-maintained files / 325,347 lines; all remaining violations are
outside the frontend. The frontend scan finds 2,326 files / 153,735 lines and
zero files over 200. An additional frontend audit found existing shared
dashboard/table/fallback components already used across pages; the inspected
metric, loading, empty, error, confirmation, and list renderers had distinct
presentation or accessibility contracts, so this checkpoint adds no new
frontend abstraction. The frontend's 10,000–30,000-line target and API's
100,000-line reduction goal remain outstanding. No deployment was performed.
