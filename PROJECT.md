# Hanasand project context

## Purpose and boundaries

- Hanasand combines threat intelligence, AI development tools and infrastructure management at [hanasand.com](https://hanasand.com).
- This repository owns the Next.js frontend, Bun/Fastify API, application operations and initial database schema. PostgreSQL stores account and application data.
- Services such as Identity, TI, AI inference, parser, scraper, browser workers, mail and database backups have separate repositories or deployments. See the service map in [README.md](README.md).
- API compatibility, persisted data, user-visible behavior and existing integrations must be preserved unless the user explicitly changes the requirement. Trace real callers and service boundaries before restructuring.
- Hanasand code and product language conventions are in [README.md](README.md), [docs/copy-style.md](docs/copy-style.md), and applicable module guidance. Keep user-facing language short and natural; implementation explanations belong in the task response.

## Workflow and coordination

- Adopted portable guidance: AgentOnboarding `AGENTS.md`, `CODE_QUALITY.md`, and `docs/coordination.md`, revision `9566e73d544ab52f2968fd748451f4239b834393` (2026-10-16). Compare updates with these local rules before adoption.
- Local tailoring: optional role, handoff, and experience records are used when a task or project has them; they are not mandatory files for every change.
- For small, cohesive changes, work directly. For broad reviews/refactors, use parallel agents early for genuinely independent areas; keep a ready queue of authorized work, monitor results, and reassign useful follow-up or review work while it remains. Do not serialize independent reviews behind one agent or create busywork when no useful work remains.
- Give every agent exclusive file/path ownership or an isolated worktree. In a shared checkout, do not allow concurrent edits to the same paths. Assign independent review to a different agent from the author. Use traditional Norwegian given names for delegated agents, as requested by the owner.
- Name one integrator for shared Git state, builds, and final verification. Ask agents to run focused checks and make regular, scoped local commits when their owned work is verified. The integrator must review commits, test the combined candidate, resolve conflicts, and report exact evidence and limits.
- For large cleanup, judge structure, readability, duplication and responsibility boundaries as acceptance criteria alongside correctness. Measure source, test and generated/vendor code separately. Preserve observable behavior and effective tests; do not chase a line-count target through cosmetic splitting, deleting useful coverage, or compressing code. When the owner sets a measurable reduction goal, track the actual baseline and candidate and explain any part that cannot be met safely.

## Verification

From `api/`, use Bun 1.3.13:

- Focused tests: `bun test tests/<relevant-test>.test.ts`
- Full API test runner: `bun run test`
- Lint and typecheck: `bun run lint`
- Typecheck alone: `bun run typecheck`
- API audit: `bun run audit`

Select the narrowest checks that cover the changed behavior, then run required milestone checks for the integrated candidate. Many smoke checks require a local API/database and run the production-safety guard; read their prerequisites and do not point them at production accidentally. A skipped or mocked test is not live integration evidence. See `api/package.json` for current commands and `README.md` for setup/deployment details.

## Git, publication, and deployment

- Use `main`; do not create branches. Preserve unrelated work and stage only owned paths. Never commit private configuration or credentials.
- Agents may create scoped local commits after verification. In the shared checkout, use path-scoped `git commit --only -m "..." -- <owned paths>` and inspect the exact commit contents; do not commit the shared index wholesale. Publication is for the completed, integrated request: push `main` to both Forgejo (`origin`) and GitHub (`github`), then redeploy only the affected service from a local development checkout. Routine publication and deployment have standing owner authorization, but do not publish intermediate work from an unfinished multi-stage request.
- Never deploy from Inspur or OVH. Update server checkouts only by fast-forwarding `main`. Keep runtime-owned directories writable; do not change ownership or permissions to enforce Git policy.
- Deploy only the changed component. Do not use stack-wide `docker compose up --build`; use the frontend deploy script for frontend changes. For API changes, build and replace only the API service as documented in `README.md`.
- After deployment, verify the deployed revision, affected live behavior, service logs and container state. Schema changes require a separate rollback plan; image rollback does not reverse a migration.

## Product and operational contracts

- Monitoring events are collected into HA cases. Only the shared case sender may notify Discord, at most once per case and destination every 24 hours, including across restarts and recurrence. Preserve this contract when changing monitoring, case, or notification code.
- Do not create timestamped monitor users or one-off production audit users. Reuse an existing service account with only the endpoints the task needs. On `hanasand`, protected `/home/hanasand/hanasand/ops/monitoring-state/service-accounts.env` contains `MONITOR_SERVICE_ACCOUNT_KEY` and `HANASAND_DB_MONITOR_SERVICE_ACCOUNT_KEY`. Load credentials locally on that server; never print, copy into chat, or commit keys. Use `X-API-Key`. Missing scope is a configuration issue, not a reason to create a user or grant administrator roles.
- Service accounts are managed at `/management/service-accounts` or `GET/POST /api/service-accounts` and `DELETE /api/service-accounts/:id` with a system-administrator session. Creation accepts `{name, scopes: [{method, route}]}` and returns the key once. No wildcard permissions or human login sessions are granted. The database browser monitor can use its service key in a short-lived browser context; the frontend permits only GET/HEAD `/db` and the API still enforces endpoint scopes. Revoke unused accounts through the service-account API.

## Completion report

Make the final response self-contained. Briefly recap the request and later corrections, explain what changed and why, link to affected live pages or relevant repository files/commits, and include the commit hash, verification, confirmed push/deployment status, and any unfinished work. Never claim publication or deployment before verifying it.
