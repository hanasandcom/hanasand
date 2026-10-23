# Watchlists source and projection staging

This fixture adds the missing actual Core source-write, organization-header and
direct Identity audit boundaries to the existing 95 customer proof and c3 service
fixtures. It uses actual handlers/limiter, bound P256 sessions, PostgreSQL and the
selected service projection. It does not start production workers or rebuild events.

## Review and inputs

Prepare only in a new clean Git clone under a private `0700` parent, with nested clone
`umask 022`. Fetch exact reviewed source through the configured Git remotes. Do not
upload source manually or copy primary dirt, live files or environment. The root
integrator owns final source union, publication, image build and execution approval.
No build/pull/deploy command is in this runner. A failed image/provenance check stops.

Required environment (all image values are full immutable sha256 IDs):

- `WATCHLIST_CORE_ROOT`, `WATCHLIST_CORE_SHA`: clean final reviewed source containing
  this fixture and approved Watchlists9b. No primary checkout.
- `WATCHLIST_IDENTITY_ROOT`: exact 0c110b9127d469d98c3e75490fd395ade63c6270.
- `WATCHLIST_SCRAPER_ROOT`: exact c3c01136bbfb1c6527fae1c97c8df62e2046a4f0.
- `WATCHLIST_API_IMAGE`: cached 1b0a405e5136d368125c5666665a728032a73780 runtime,
  known ID `sha256:6929bb23b7a18d73a8ae9fecb04115b06fd8925b8d7c644294cc86c5cbcb2ab9`.
- `WATCHLIST_IDENTITY_IMAGE`: the reviewed immutable ID from a canonical build of
  0c110b9127d469d98c3e75490fd395ade63c6270. Its OCI revision must equal that source;
  older 5e or 90 images are rejected before resource creation.
- `WATCHLIST_BUN_IMAGE`: cached TI66 Bun1.3.11 runtime/deps,
  `sha256:971982aae0fb1b84a02152b8fe6a6ed3079985c6347e1ee61343cb91376222ab`.
- `WATCHLIST_POSTGRES_IMAGE`: cached 15.19,
  `sha256:f7d23353e1b15400d22ebe31189f4d314b87a4c129cc400c8c2d8d4ca127bf81`.
- `WATCHLIST_STAGE_PREFIX`: fresh `ti-native-proof-` plus 12 random lowercase hex.
- `WATCHLIST_STAGE_SUBNET`: reviewed unused RFC1918 IPv4 /28; actual Docker IPAM and
  host routes are checked twice. Never assume a previous fixture's subnet is free.
- `WATCHLIST_STAGE_MODE`: `core-only` or `full`.
- `WATCHLIST_WEBSITE_IMAGE`: required only for full mode; canonical final compiled
  frontend image whose OCI revision equals `WATCHLIST_CORE_SHA`.

Images are not relabelled. Core actual final src is mounted into cached 1b only after
Git equality of api/package.json, bun.lock, bunfig.toml and Dockerfile. Identity
source and canonical image both require exact 0c110b9127d469d98c3e75490fd395ade63c6270;
its package/lock/Dockerfile equality guard remains in place before mounting source.
Actual runtime probes require Core/Identity Bun 1.3.13, service Bun 1.3.11 and PG 15.
An absent cached image is a stop, not permission to inspect/copy live files or build.

## Validation and execution

```sh
PYTHONDONTWRITEBYTECODE=1 python3 api/scripts/watchlists-proof-stage/test-runner.py
sh -n api/scripts/watchlists-proof-stage/run.sh
# After exact source/helper and platform review, from the private Git checkout:
sh api/scripts/watchlists-proof-stage/run.sh
```

`core-only` does not create a website container. It first proves actual Core create
through real native bound-proof validation, FDW source insertion and direct Identity
audit. The test expects canonical 201; a real FDW/default failure is a failed stage,
with owned-resource cleanup and private diagnostic logs. Do not add fixture foreign
column defaults or alter source fields to make this probe pass. A necessary runtime
fix needs separate evidence, scoped approval and regression checks.

`full` must use the one final canonical frontend build approved by the integrator.
Reuse that image sequentially for existing 95 and this fixture. The full flow sends
cookie authentication without incoming tenant/org headers through compiled Next,
then source-save partial receipt, explicit sync retry and direct native retry. Native
positive requests include the same x-device-proof-url/method headers as apiFetch.
Zero-source-write direct Core probes record wrong method/target/key/missing-proof
statuses before the source-save result; all must reject 401. The stage stays failed
if any bad claim is accepted or the faithful FDW create does not return 201. Only bounded
synthetic error code/message and counts are logged; no session tokens or proofs.

## Database and audit topology

One fresh tmpfs PG 15 container holds three databases, not one shared application DB:

1. `ti_native_proof_test`: real Identity migrations 001–006 and synthetic fixtures,
   via the unchanged c3 identity-server. Tokens, proof jtis, organization source and
   `system_events` live here.
2. `core_watchlist_proof_test`: actual `postgres_fdw` foreign tables and public views
   for required Identity-owned tables, with the same import semantics as production.
   The fixture creates these objects directly; it does NOT run the legacy
   `ensureIdentityDataBoundary` migration/cutover. Only four required billing/rate
   tables use DDL extracted verbatim from canonical helpers, passed through the real
   query normalizer that strips FK references to detached views.
3. `ti_watchlist_projection_test`: only the actual workflow_records table DDL from
   scraper migration006. Actual PostgresScraperStore and registered service route
   read fresh Identity 0c context and commit selected projections.

Core `HANASAND_IDENTITY_FDW_HOST`/`IDENTITY_DB_NAME` configure the actual direct
identityPool. Real recordSystemEvent INSERT must produce a durable Identity
BIGSERIAL ID and actor/request/selected-ID audit. A fixture-only trigger raises for
one sentinel request ID to prove audit failure stops child dispatch; it is removed
in finally. It never overrides application authorization or audit functions.

Real advisory lock contention causes the first saved mutation's pending projection
receipt. Releasing that lock permits an explicit reconcile request, not a repeated
create/update or Refresh Events. Snapshots verify source IDs/values/timestamps,
organization updated_at and billing usage stay unchanged across retry. Repeat
reconcile is unchanged; replayed proof rejects; a fresh native proof proceeds.
Only dwm_watchlist records may exist; no alert/case/plan/run/delivery generation.

The projection fixture disables the separate readiness worker, as in the existing
service-only fixture. Its minimal workflow table cannot satisfy full service health
metadata queries. Startup checks only the actual protected command transport: POST
without a service credential must return 401 with `authentication_required`, before
body, scope or store access. This is not a full service/database health claim.
Readiness or foreground setup/version failures retain at most 80 log lines from the
captured container ID after checking its exact owner, before cleanup.

Best-effort result logging uses actual code but this fixture does not provision the
full independent Logs service/schema. Related warnings are not durable audit proof;
recordSystemEvent remains real and awaited. No production log delivery claim.

## Isolation, cleanup and limits

No published ports, production networks/env/data/volumes, Docker/LXD sockets, providers
or background workers. Source mounts are read-only; root filesystems read-only with
bounded tmpfs. Resources have memory/CPU caps and no-new-privileges. Fresh owner labels
and captured immutable IDs control cleanup, including on failure. Names are checked
before create; unknown/replaced owners are preserved and cleanup failure is a failed
stage. Successful inventories verify container/network absence. Shared images are
never removed. Keep private source/provenance/logs for review; never prune/restart Docker.

This exercises real cross-database FDW/direct pools on one PG instance. It does not
prove HA, PgBouncer, host-network routing, production migration or complete API startup.
Compiled HTTP cookie requests model browser transport; they do not execute browser
DOM/service-worker key generation. Existing95/c3 and native UI fixtures remain separate
evidence. Offline tests use no Docker daemon; static cleanup/source contract checks
are not a claim that failure cleanup was exercised against live Docker.
