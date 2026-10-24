# Hanasand

Hanasand combines threat intelligence, AI development tools, and infrastructure management at [hanasand.com](https://hanasand.com). The public site and authenticated dashboard share a Next.js frontend and a Bun/Fastify API. PostgreSQL stores accounts and application data.

## Service map

| Component | Source | Responsibility |
| --- | --- | --- |
| Frontend | `frontend/` | Public pages, dashboard including native mail at `/mail`, AI editor, shared projects, the static archive generated from the [Articles repository](https://github.com/hanasandcom/articles), notes and thesis |
| API | `api/` | Authorization, organizations, permissions, billing, AI requests, project storage, infrastructure and public API |
| Scanner UI | `frontend/src/app/dashboard/scanner/` | Browser interface at `/scanner`; calls the independent [Scanner service](https://github.com/hanasandcom/scanner) API and does not run scans through the Hanasand API. It defaults to paused; set the frontend build argument `NEXT_PUBLIC_SCANNER_SERVICES_PAUSED=false` only after Scanner services are ready. |
| Logs | [Logs repository](https://github.com/hanasandcom/logs) | Independent log ingestion, PostgreSQL database, API and processing worker. The Hanasand frontend can route supported search, realtime, service, throughput metric and tuning reads directly to Logs when `FRONTEND_LOGS_API_URL` is configured. |
| Identity | [Identity repository](https://github.com/hanasandcom/identity) | Login, sessions, password reset, passkeys, social/SSO and signup; separate workers, using the existing account database through PgBouncer |
| Threat intelligence | [TI repository](https://github.com/hanasandcom/ti) | Standalone web application and API; source collection, evidence, search, alerts and investigation cases run with a dedicated database and scraper |
| AI API and model client | [AI repository](https://github.com/hanasandcom/ai) | Stores AI chats, serves AI routes and connects the Inspur inference server over WebSockets; deployed separately |
| Parser | [Parser repository](https://github.com/hanasandcom/parser) | AI parsing HTTP service; deployed separately |
| Scraper | [Scraper repository](https://github.com/hanasandcom/scraper) | Threat-intelligence collection service; deployed separately |
| Model runtime | [GPT repository](https://github.com/hanasandcom/gpt) | GPU model server and its independent startup service |
| Browser workers | [Browser repository](https://github.com/hanasandcom/browsers) | Browser worker image and its independent Compose service |
| Browser TURN | [Browser TURN Compose](https://github.com/hanasandcom/browsers/blob/main/turn/compose.yml) | Coturn relay with an independent Compose deployment |
| Browser host firewall | [Ops repository](https://github.com/hanasandcom/ops/tree/main/browser-worker) | Host egress rules for isolated browser sessions |
| Discord bot | [Discord bot repository](https://github.com/hanasandcom/bot) | Support tickets and chat bridge; deployed from its own Compose project |
| Onion proxy | [Onion repository](https://github.com/hanasandcom/onion) | Tor and Privoxy endpoint for browser and application traffic; deployed separately |
| PgBouncer | [PgBouncer repository](https://github.com/hanasandcom/pgbouncer) | Primary and rolling-release PostgreSQL connection pools; deployed separately |
| Database | `db/`, `api/src/utils/db/` | Initial schema and application schema updates |
| Mail service and SMTP relay | [Mail server repository](https://github.com/hanasandcom/mail-server) | Stalwart and host-specific SMTP relay containers, deployed through an independent Compose stack |
| Database backup worker | [Ops database-backup module](https://github.com/hanasandcom/ops/tree/main/backup) | PostgreSQL backups, retention and restore workflows; runs separately from API releases |
| Mail web and API | [Mail web repository](https://github.com/hanasandcom/mail-web) | Standalone webmail at `mail.hanasand.com` and its dedicated browser API. Dashboard `/mail` uses the shared UI package and calls that API directly. The Mail API validates sessions with Identity and reads existing mail data from PostgreSQL; browser requests do not pass through the Hanasand frontend or general API. |
| Client apps | [Hanasand app repository](https://github.com/hanasandcom/app) | Mobile client; the native [desktop repository](https://github.com/hanasandcom/desktop) is also mirrored on [Forgejo](https://git.hanasand.com/hanasandcom/desktop) |
| Operations | [Ops repository](https://github.com/hanasandcom/ops) | Application deployment, host monitoring, maintenance, health checks and infrastructure integrations |

`docker-compose.yml` includes `docker-compose.api.yml` and defines the service connections, ports, volumes and health checks. Use Docker Compose 2.33.1 or later. OpenResty terminates public HTTPS outside this Compose project. The root API forwards authentication routes to Identity over a private network, while the existing PostgreSQL records and public API paths stay in place. The API also integrates with external VM hosts, password lookup and other configured services. VM owners and editors can publish up to 1,000 services per VM through the shared port-443 gateway; see [VM public services](docs/vm-public-services.md).

The VM builder supports Debian 13, Ubuntu 22.04, 24.04, 26.04 and Ubuntu Desktop 24.04, with Small (1 vCPU, 2 GiB RAM, 10 GiB disk), Standard (2 vCPU, 4 GiB RAM, 20 GiB disk), and Large (4 vCPU, 8 GiB RAM, 40 GiB disk) plans. Custom allocations can use 1–10 vCPU and 1–64 GiB RAM with a 40 GiB disk; service-specific minimums still apply. The OS, resource and Minecraft software choices use the same custom dropdown control. The service catalog includes Node.js/npm, Bun, Python, Java, Go, PHP/Composer, Rust/Cargo, Ruby, C/C++ build tools, Docker, PostgreSQL, MySQL, SQLite, Redis, Nginx, a generated static website, and Minecraft Java. AI infrastructure plans can choose these services and up to 12 packages from the selected Debian-family OS archive. Simple informational sites use a static website draft; custom interactive web apps can generate a bounded Next.js source manifest with a server-owned, fixed Next.js/React package manifest. The VM API validates paths and size, then the guest installs, builds and runs the app as the unprivileged VM user. This does not generate arbitrary host shell commands, game-server installers, database credentials, or external API integrations. Unsupported plans return an error and cannot silently create an empty VM. NixOS is unavailable on the current LXD 5.21 VM image source, and the 443 gateway currently supports Minecraft Java rather than arbitrary UDP game protocols.

Browser sessions use a non-extractable P-256 WebCrypto key held in IndexedDB. Authenticated browser requests carry a signed DPoP proof bound to the request method, URL and session token; Identity checks the signature and rejects replayed proofs. A copied session token alone cannot authenticate. Existing sessions without a key binding require one sign-in after migration. Same-origin script execution and browser-profile compromise remain able to use the browser-held key.

The frontend sends AI workspace requests to the separate AI API. On the shared Docker network, its server-side URL defaults to `http://ai:19182/api`; set `FRONTEND_INTERNAL_AI_API` when a deployment uses another address.

PgBouncer, Onion, browser workers, TURN, and the Discord bot run from independent Compose projects on the established Hanasand networks. The root release checks the infrastructure services it depends on but does not build or recreate those services.

## Monitoring issues

The VM lifecycle monitor runs every six hours. It creates a disposable virtual machine, checks its identity and configuration, starts and stops it, deletes it, and confirms the host no longer lists it. Configure it only on the VM staging stack with `VM_LIFECYCLE_MONITOR_ENABLED=true`, `VM_LIFECYCLE_MONITOR_TARGET=isolated-staging`, and `VM_LIFECYCLE_MONITOR_PROJECT=hns-stage`. Before any instance request, the monitor checks that `hns-stage` is restricted, network-limited, and has instance and VM quotas. Every instance, state, operation-wait, cleanup, and inventory request carries `project=hns-stage`; missing, default, and other projects fail closed without instance requests. The `hns-stage` project is restricted to the staging network and must retain its limits. See `docker-compose.vm-stage.inspur.yml` and `staging/vm-stage/README.md` for the staging-only settings. The monitor never falls back to the default LXD project.

External sensor hubs can submit incident, recovery and heartbeat events to an **External events** check. See [external monitoring](docs/external-monitoring.md) for the event schema, sender setup and mock.

All monitoring alerts, including replication, backups and failover, must go through HA cases. Never post individual events directly to Discord. Repeated events update the same case; only that case may notify Discord, once per destination every 24 hours. Recovery and recurrence do not reset that limit.

Each intelligence health check keeps the same case when its error changes, including connection failures. Collection, enrichment and delivery remain separate checks. When duplicate cases are merged, keep their old links, events, comments and notification history, and preserve the latest notification deadline.

The standby case reader uses the read-only grants in `db/standby-permissions.sql`. Keep case writes, VM passwords and repository secrets out of that role.

Recovery checks run every minute using `system:recovery` and the monitor's read-only state file. Run `bun scripts/setup-recovery-monitoring.ts` in the API worker to configure them with the existing Hanasand owner, organization and Discord destination. The independent recovery monitor keeps sampling and routing traffic; the API creates cases when it can reach the writable database.

A failed save must not turn a successful check into a service outage. Report the monitoring job's error without adding a false failure to the checked service's case.

Use simple, natural language in alerts, cases, UI text and documentation. Say what happened and what to do next. For example: “WAL replication lost. Restore the replica from a backup.” and “No backup taken in 36 hours.” Keep diagnostic details in the case. Do not say services have recovered while the case is still failing. See [copy style](docs/copy-style.md).

Health-check failures and slow responses are grouped by monitor, target and failure reason in `monitoring_issues`. Each has a stable `HA-<number>` reference, occurrence count, first/last seen times and recovery time. Check records link to the issue; recovery closes it, and recurrence reopens the same number. Details are returned by the authenticated `GET /api/automations/:id` endpoint and shown in the monitoring dashboard.

Discord receives `@everyone` and the case number, at most once per issue and destination every 24 hours. PostgreSQL reserves delivery before sending, so restarts and concurrent workers do not reset the limit. Failed or uncertain delivery is recorded in the issue and waits for the same 24-hour window before retrying. Monitoring results remain independent of notification delivery. These persisted records appear alongside other cases at `/cases`, with details at `/cases/HA-<number>`. The shared case page is independent of DWM and reports unavailable sources without hiding cases from the remaining sources. Existing `/dwm/cases` links redirect to `/cases`; old `MON-` links redirect to the corresponding `HA-` case.

## Agent task completion

Agents must finish requested changes by verifying them, committing, pushing to both GitHub and Forgejo, redeploying the affected service, and checking the deployed revision and live behavior. Routine publication and deployment have standing authorization.

Every final response must briefly recap the user's request, explain what changed, and include clickable links to the affected live pages so the user can check them. For work without a page, link to the relevant repository file or commit instead. Include the commit hash, relevant checks, and confirmed push/deployment status; clearly identify anything unfinished. The response must stand on its own without requiring the user to reread progress messages.

See [AGENTS.md](AGENTS.md#completion-responses) for the repository-wide agent instructions.

## Development

Use Bun 1.3.11, Node.js 22 and Docker Compose. Install dependencies in the component you are changing with `bun install`.

The root `.env` is private and is not committed. Obtain a development configuration from the operator; never copy production credentials into tests. The API requires `DB_HOST`, `DB_PASSWORD` and `VM_API_TOKEN`. Also configure `DB`, `DB_USER` and `DB_PORT` for the development database. Match the frontend API URLs to that environment; several defaults point at production.

The API reads article Markdown from the public [Articles repository](https://github.com/hanasandcom/articles) over HTTPS. Dashboard article changes publish to both GitHub and Forgejo. Production must provide `ARTICLES_GITHUB_USERNAME`, `ARTICLES_GITHUB_TOKEN`, `ARTICLES_FORGEJO_USERNAME` and `ARTICLES_FORGEJO_TOKEN` through its protected deployment environment. Restrict the GitHub token to the `hanasandcom/articles` repository with Contents write access, and the Forgejo token to that repository with repository write access. Do not put tokens in Git remote URLs or repository configuration.

Run in separate terminals:

```sh
cd api
bun run start:local
```

```sh
cd frontend
bun run dev
```

The local API defaults to port 8080 and the frontend to 3000. A host process reaches the Compose database on port 8503; containers use `postgres:5432`. Use a separate development database. API startup applies schema updates and starts scheduled jobs, so do not point a development server at production.

## AI

`POST /api/tools/ai` handles AI requests. Common project requests can use built-in generators; other requests go to a connected model. `GET /api/ai/models` reports connected models. An empty list means inference is unavailable, even if the API and parser bridge are healthy.

The model client uses `HANASAND_AI_CLIENT_API_WS`, `HANASAND_AI_OPENAI_BASE` and `HANASAND_AI_MODEL`. The model runtime is deployed separately from [the GPT repository](https://github.com/hanasandcom/gpt). Starting the client alone does not start an inference server.

ChatGPT replies use the same conversation transcript as Hanasand GPT, with a separate worker thread for each chat: `threadId` is `chatgpt-<conversationId>`. A worker claims the next queued message with `GET https://hanasand.com/api/prompt/worker` and `Authorization: Bearer <PROMPT_PORTAL_WORKER_TOKEN>`. A successful response includes `item.context` and the exact `threadId`; each GET claims one queued item and marks it running. After generating the reply, post it to the same endpoint:

```http
POST https://hanasand.com/api/prompt/worker
Authorization: Bearer <PROMPT_PORTAL_WORKER_TOKEN>
Content-Type: application/json
```

```json
{
  "action": "complete",
  "id": "<item.id>",
  "threadId": "<threadId returned by GET>",
  "status": "done",
  "result": "<assistant response>"
}
```

Use `status: "error"` when the worker cannot answer. The `id` and `threadId` must match the claimed item; do not combine messages from different threads. Configure the same worker token in the app's `PROMPT_PORTAL_WORKER_TOKEN` environment variable.

Generated projects include source, a README, environment examples, build commands and Docker configuration. Website output includes its page, layout and CSS. The AI Next.js flow creates a repository, sends the validated project files to a VM, installs dependencies, builds the project, starts it on port 3000 and reports the preview only after the VM reports successful startup. Other generated projects are starting points: API records and worker queues currently use in-memory state, and external integrations require implementation. A generated project or passing source check is not evidence that a production integration works.


### Host and JSON monitoring

`GET https://api.hanasand.com/api/metrics` requires an authenticated session and includes numeric host telemetry under `host`. The host collector (`../ops/scripts/hanasand/host-metrics.ts`) samples every 15 seconds and writes an atomic file shared read-only with API workers. Install or update it on Inspur with `sudo sh ../ops/scripts/hanasand/install-host-metrics.sh`. After the API schema is ready, run `bun scripts/setup-host-monitoring.ts` in the API worker to add the six checks with the existing Discord destination. Re-running setup preserves configured checks. Snapshots older than 90 seconds are unavailable, never treated as healthy.

Health checks support JSON fields, comparisons and maximum/minimum/average/first-value aggregation. Dot paths support array wildcards, for example `host.storage.*.usedPercent`. Checks for the same owner, URL and request options share one response per minute, including errors. PostgreSQL locking prevents duplicate fetches across workers. Responses are limited to 1 MiB; obsolete cache entries expire. The administrator-only `system:metrics` source reads the same host payload locally, without storing a session credential.

Storage, RAM, CPU and GPU alert strictly above 80%. Temperature and power alert above `floor(reported hardware limit × 0.9)`; their `margin` is the alert limit minus the reading, so checks alert below zero. Missing limits stay null. Power covers reported CPU/GPU devices, not unmetered wall power. Separate checks keep their own history, case number and 24-hour Discord cooldown. Discord messages contain `@everyone HA-<number>`; accepted message IDs and mention status are recorded for delivery review.

### AI monitoring

- [Connected models](https://api.hanasand.com/api/ai/health/models): reports the current model connection count; HTTP 503 when none are connected.
- [Inference](https://api.hanasand.com/api/ai/health/inference): runs a small request through the production WebSocket path; HTTP 503 if it cannot complete. Results are shared for 30 seconds to limit probe traffic.

Both checks run every minute under Dashboard → Automation → Monitoring and use the existing Discord destination. `bun scripts/setup-ai-monitoring.ts` in `api/` configures them from the Hanasand API monitor without exposing its webhook. Failed availability checks keep running.

Monitoring history uses the actual stored check count, supports date filters, and loads older checks on scroll. Graph bars show recorded results; uptime is calculated from completed checks.

## Tests

Run the checks for the component you change:

```sh
cd api
bun run test
bun run lint
```

```sh
cd frontend
bun run test
bun run lint
bun run build
```

The API command runs the core checks and every unit test in `api/tests`, with each file in a separate process. Database, server, network and browser checks are opt-in through `api/scripts/index.ts`; run them against disposable services. The thesis database check also requires `THESIS_TEST_DATABASE=1`. Automation history requires `DB_HOST=monitor-test-db`; thesis storage requires `DB_HOST=thesis-test-db`.

Generated-project checks cover exported files, TypeScript, API validation and pagination, worker retries and cancellation, and honest website output. Run `bun run test --only=generated-builds` in `api/` to install each generated project's declared dependencies and build all four project types. This requires npm and package-registry access. Set `GENERATED_PROJECTS_DIR` to retain the builds.

The real website browser test is `frontend/tests/generated-website.spec.ts`. Point `GENERATED_WEBSITE_URL` at the generated website you started, then run that file with Playwright. It checks keyboard navigation, mobile layout, zoom, runtime errors and contact configuration. If the website was built with `CONTACT_EMAIL`, supply the same value as `GENERATED_WEBSITE_CONTACT_EMAIL` to the test.

The old share-chat story suites were removed: minimum file counts, required document phrases and test-authored preview pages did not verify generated application behavior.

The collector has its own `bun run test` and `bun run check` commands in the TI repository's `scraper/` directory.

## Production deployment

Host TypeScript utilities require Bun 1.3.13; install it for the host account with `../ops/scripts/hanasand/install-typescript-runtime.sh` before enabling their systemd units.

Use `ssh inspur` and work from `/home/hanasand/hanasand`. Deploy only the changed component.

```sh
# Frontend: build, check, switch traffic, then remove the old container.
../ops/scripts/hanasand/deploy.sh
# Or run: make -f ../ops/Makefile deploy
# Use an already tested image tagged hanasand:
../ops/scripts/hanasand/deploy.sh --no-build

# API: fast-forward main, retain the prior image, then replace and verify only API.
sh ../ops/scripts/hanasand/deploy-api.sh
```

Do not use a stack-wide `docker compose up --build`. Do not replace the frontend directly through Compose; use the script to avoid a gap in service. API replacement can briefly interrupt requests and WebSockets.

After deployment, check the affected page or endpoint, service logs and `docker compose ps`. The frontend alternates between ports 3000 and 3100, with OpenResty routing traffic to the active container. `FRONTEND_LOGS_API_URL` is optional and empty by default; set it to `https://logs.hanasand.com/api` to route supported log reads (`search`, `realtime`, `services`, `services/summary`, throughput metrics, and tuning) directly to Logs. Deploy and verify the matching Logs API first. Logs validates private reads with Identity; search, realtime, and service data require an active `organizationId`, which the frontend proxy supplies when absent. Private throughput and tuning require platform owner, admin, or editor membership; public throughput metrics remain anonymous. The API supports `LOGS_OUTBOX_REMOTE_ONLY=1` with `LOGS_OUTBOX_ENABLED=1` to stop inserting a second copy into Hanasand's `events` table while the durable Hanasand outbox transfers entries to Logs. In remote-only mode, Hanasand also skips its old log processors, rule reprocessing, log indexes, and log analytics refreshes; the Logs outbox worker remains active, including on auth-only API workers. Startup fails if remote-only mode lacks the outbox or its Logs credentials. Keep remote-only mode off until authenticated ingestion and Logs worker processing are verified; keep the outbox enabled so delivery remains durable. Remote-only mode does not migrate existing rows or remove the temporary transfer queue. From `api/`, `bun scripts/migrate-logs-to-service.ts` estimates rows filtered to `ingestion_id='logs'` and reports physical sizes for log-prefixed and related tables without changing data. The row estimate comes from PostgreSQL's planner and is not an exact count. Add `--apply` only after remote-only mode is active; the migrator streams `events` rows with `ingestion_id='logs'` to the Logs API and waits until the worker marks each retained event processed (or confirms its drop receipt). It also transfers linked findings with analyst status, assignee, notes, evidence and case references before deleting their unchanged source records. The migrator also transfers general analysis/drop receipts, compressed model-probe and readiness-audit receipts, proxy receipts, and the event-linkage archive, verifying each target batch before deleting its unchanged source rows. After target receipts and linked findings are verified, it truncates empty receipt and hit-count tables before migrating events to reclaim their space incrementally. Logs dimensions and counts rebuild as source events replay. At completion, the migrator clears remaining log-prefixed processing state only after no Hanasand Logs events or migration receipts remain, then truncates `events` and `findings` only when those tables are empty. Non-Logs rows are preserved; any nonempty shared relation still needs a capacity-checked rewrite to reclaim its unused pages. The API-only helper tags and retains the prior API image, then restores and verifies it if the new API fails startup. It reuses the prior database schema marker only when the release classifier finds no product DDL and the prior marker exists. An image rollback does not reverse database changes; any DDL from a failed release needs a separate recovery plan.

The runtime-state pass also copies access, Mongo, and proxy counters; access-window, PostgreSQL-session, ingest-access, and routine-group state; ingestion canonical records and copies; throughput samples; and tuning snapshots. Each destination batch is verified before the matching unchanged source rows are removed. Canonical ingestion records are copied before their dependent copies, then removed after the copies move.

### Hanasand app staging

`docker-compose.staging.yml` runs the Hanasand app on a separate Compose project before production release. It has its own PostgreSQL volume, serves only on `127.0.0.1:3280` and `127.0.0.1:3282`, and connects only to the existing staging Identity and AI networks. Its local sign-in screen submits only to the private staging Identity API; external SSO, passkeys, signup, and password reset remain unavailable in this isolated target. It does not mount the production LXD socket, Docker socket, host cron, production database, or production environment file. The staging API runs in HTTP-only candidate mode so it applies its schema and serves requests without starting background workers. `VM_HOST_ID=staging-disabled` deliberately prevents this app stack from provisioning VMs. Testing VM creation, Next.js guest builds, or the VM lifecycle monitor requires a separate isolated LXD staging host and API routing target; never point app staging at a production VM host.

On Inspur, create `/home/hanasand/hanasand/.env.app.staging` with mode `0600`. It must contain newly generated, staging-only values for `DB_PASSWORD`, `VM_API_TOKEN`, and `PROMPT_PORTAL_WORKER_TOKEN`; never copy them from a production environment file. The staging database starts from the repository's schema and keeps its data in the `hanasand_app_staging_postgres_data` Docker volume. The API also reads the staging-only Identity service token and support key from `/home/hanasand/identity/.env.ai.staging`.

From a clean `main` checkout, start or update the API and frontend in the app staging stack with:

```sh
cd /home/hanasand/hanasand
HANASAND_RELEASE_COMMIT=$(git rev-parse HEAD) docker compose \
  --project-name hanasand-app-staging \
  --env-file .env.app.staging \
  -f docker-compose.yml -f docker-compose.staging.yml \
  up -d --build api frontend
```

Check the app and API revisions with `curl -fsS http://127.0.0.1:3280/api/health`, and check API process health with `curl -fsS http://127.0.0.1:3282/health`. Check inference from the staging API container, which is connected to the staging AI network: `docker exec hanasand_app_staging_api curl -fsS http://172.31.254.6:19182/api/ai/health/inference`. To review the staged UI from another machine, forward ports 3280 and 3282 as above plus the AI staging WebSocket (`-L 8389:172.31.254.6:19182`), then open `http://localhost:3280/ai`. Resetting the staged app database means removing only the `hanasand_app_staging_postgres_data` volume after stopping this Compose project; never remove the production `hanasand_postgres_data` volume.

## Data and operations

PostgreSQL, API state, prompt submissions and mail are persistent. `db/init.sql` initializes the application database; application schema updates run through `api/src/utils/db/ensureSchema.ts`. TI source records and evidence use the separate TI database and its repository migrations.

Database backups run in the independent database-backup Compose project. They use the persistent `hanasand_api_state` volume for archives and audit state; application releases neither rebuild nor restart the worker. Keep an independent copy and verify restoration; a backup on the same host does not cover host loss. TI backup tools are maintained in the TI repository. Do not delete volumes during deployment.

Start diagnosis with `docker compose ps` and `docker compose logs --tail=100 <service>`. `/api/health` checks the API process; `/api/ai/models` checks model connections. Use the dashboard status page for collection, processing and dependency failures. A healthy container does not imply that its external dependencies work.

## Shared thesis

`/thesis` is public. Dashboard → Admin → Thesis opens the editor. Only account ID `eirikhanasand` can edit; permissions do not depend on its display name.

PostgreSQL stores the shared title and content. Edits autosave after five seconds and broadcast over `/api/ws/thesis`. Unchanged content causes no write. Leaving the page triggers a final save attempt; local recovery drafts cover interrupted delivery and browser request limits.

History keeps the previous version, 20-minute checkpoints for seven days, then up to three checkpoints per day. Stale concurrent writes require a choice of versions. Restoring a version preserves the text it replaces.

## Contributing

Follow [AGENTS.md](AGENTS.md) and [copy style](docs/copy-style.md). Keep changes focused, verify them, and push `main` to both Forgejo (`origin`) and GitHub (`github`). Do not include private configuration or credentials in commits or logs.

### Authentication releases

Authentication is deployed as part of the canonical full-stack release. Standalone recovery/auth replacement commands are intentionally removed; use `../ops/scripts/hanasand/deploy-all.sh` so the API, frontend, and supporting services stay on one main revision.

Mobile and desktop sign-in use the same Identity passkey records and RP ID as the website. iOS and macOS passkey access requires each app's `webcredentials:hanasand.com` entitlement and an app identifier in `frontend/src/app/.well-known/apple-app-site-association`; Android sharing requires `public/.well-known/assetlinks.json` to list the app signing certificate. Keep Identity's exact `PASSKEY_ALLOWED_ORIGINS` in sync with the Android signing key. Mobile and desktop SSO start at `/api/auth/mobile/sso/start`; the website binds the short-lived Identity handoff code to the client's PKCE challenge and returns only that code through the registered app scheme. Release the desktop app and website SSO/association changes together. When Google Play App Signing is enabled, include its signing certificate fingerprint as well as the EAS upload certificate.
