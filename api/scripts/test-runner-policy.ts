type UnitTestCategory = 'unit' | 'database' | 'postgresFilter'

// Every direct api/tests/*.test.ts|*.test.mjs suite must be registered here.
// Unknown files fail runner discovery instead of accidentally running in the
// default suite. The optional local PGlite suite stays a unit task because it
// skips itself unless PUSH_TEST_PGLITE_MODULE is configured.
const unitTestFiles = [
    'access-alert-severity.test.ts', 'account-availability.test.ts', 'account-deletion-scheduler.test.ts', 'agent-action-audit-redaction.test.ts', 'agent-action-policy-decisions.test.ts', 'agent-action-policy-routes.test.ts', 'analysis-matcher.test.ts', 'analysis-policy.test.ts', 'analyze-access.test.ts', 'analyze-cdn-delivery-ingest.test.ts', 'analyze-cdn-delivery.test.ts', 'analyze-cdn-refresh-ingest.test.ts', 'analyze-cdn-refresh.test.ts', 'analyze-ingestion.test.ts', 'analyze-model-discovery-ingest.test.ts', 'analyze-model-discovery.test.ts', 'analyze-mongo-ingest.test.ts', 'analyze-mongo.test.ts', 'analyze-postgres-ingest.test.ts', 'analyze-postgres.test.ts', 'analyze-proxy.test.ts', 'analyze-readiness-audit.test.ts', 'analyze-routine-groups.test.ts', 'api-requester.test.ts', 'app-update.test.ts', 'application-error.test.ts', 'apt-updates.test.ts', 'article-storage.test.ts', 'auth-history.test.ts', 'automatic-review-cron.test.ts', 'automation-certificates.test.ts', 'automation-persistence.test.ts', 'background-analytics.test.ts', 'backup-worker-client.test.ts', 'browser-task-analysis.test.ts', 'browser-task-handler.test.ts', 'canonical-json.test.ts', 'case-commits.test.ts', 'case-delivery.test.ts', 'case-development.test.ts', 'check-scheduled-job-registry.test.ts', 'code-review-access.test.ts', 'commercial-contact-requests.test.ts', 'contact-mail-sender.test.ts', 'container-billing.test.ts', 'content-organization.test.ts', 'custom-retention.test.ts', 'database-browse-parser-version.test.ts', 'database-overview-summary.test.ts', 'database-response.test.ts', 'database-storage.test.ts', 'delete-user-ownership.test.ts', 'desktop-agent-presence-tls-pin.test.ts', 'docker-response-recovery.test.ts', 'docker-storage.test.ts', 'drop-eligibility.test.ts', 'drop-rate-alert.test.ts', 'dwm-destination-example.test.ts', 'dwm-webhook-core-contracts.test.ts', 'dwm-webhook-delivery-attempt-contract.test.ts', 'dwm-webhook-delivery-attempt-validation.test.ts', 'dwm-webhook-delivery-concurrency.test.ts', 'dwm-webhook-delivery-outcomes.test.ts', 'dwm-webhook-delivery-projection.test.ts', 'dwm-webhook-delivery-read-models.test.ts', 'dwm-webhook-delivery-readiness.test.ts', 'dwm-webhook-delivery-retry-route.test.ts', 'dwm-webhook-delivery-route.test.ts', 'dwm-webhook-delivery-selection.test.ts', 'dwm-webhook-destination-crud-contract.test.ts', 'dwm-webhook-destination-health-contract.test.ts', 'dwm-webhook-destination-preflight-routes.test.ts', 'dwm-webhook-lifecycle-blockers.test.ts', 'dwm-webhook-lifecycle-truthfulness.test.ts', 'dwm-webhook-receiver-atomicity.test.ts', 'dwm-webhook-receiver-receipts.test.ts', 'dwm-webhook-receiver-route.test.ts', 'dwm-webhook-report-filter.test.ts', 'dwm-webhook-report-retry-contract.test.ts', 'dwm-webhook-schema.test.ts', 'dwm-webhook-security-canonical-report.test.ts', 'dwm-webhook-security-payload.test.ts', 'dwm-webhook-security-receiver.test.ts', 'dwm-webhook-security-transport.test.ts', 'dwm-webhook-test-response-context.test.ts', 'dwm-webhook-test-response.test.ts', 'dwm-webhook-transport.test.ts', 'dwm-webhook-visibility-access.test.ts', 'ensure-schema-tables.test.ts', 'event-log-schema-bootstrap.test.ts', 'event-privacy.test.ts', 'event-processing.test.ts', 'guest-disk-usage.test.ts', 'host-check-message.test.ts', 'http-errors.test.ts', 'http-surface-registration.test.ts', 'impersonation-token.test.ts', 'ingestion-protection-exception.test.ts', 'internal-token-rotation.test.ts', 'json-monitoring-retries.test.ts', 'json-monitoring.test.ts', 'legacy-rule-hit-migration.test.ts', 'load-test-summary.test.ts', 'load-test-websocket-rerun.test.ts', 'log-catchup-limit.test.ts', 'log-catchup-progress.test.ts', 'log-counts-schema.test.ts', 'log-dimensions.test.ts', 'log-event.test.ts', 'log-ingest-boundary.test.ts', 'log-ingest.test.ts', 'log-kql.test.ts', 'log-metrics.test.ts', 'log-migration-event.test.ts', 'log-migration.test.ts', 'log-outbox-delivery.test.ts', 'log-outbox.test.ts', 'log-processor.test.ts', 'log-redaction.test.ts', 'log-search-capacity.test.ts', 'log-search-page.test.ts', 'log-search-stats.test.ts', 'log-stored-sources.test.ts', 'log-tuning-refresh.test.ts', 'log-tuning-sample.test.ts', 'log-unknown-fields-retention.test.ts', 'log-watermark.test.ts', 'log-worker.test.ts', 'logs-access.test.ts', 'logs-cache.test.ts', 'logs-most-active.test.ts', 'lxd-operations.test.ts', 'lxd-response-recovery.test.ts', 'mail-account-provisioning.test.ts', 'mail-attachment-routing.test.ts', 'mail-content-safety.test.ts', 'mail-health.test.ts', 'mail-jmap-retry.test.ts', 'mail-message-reputation.test.ts', 'mail-overview-performance.test.ts', 'mail-overview-summary.test.ts', 'mail-pagination.test.ts', 'mail-read-state.test.ts', 'mail-relay-health.test.ts', 'mail-reputation-concurrency.test.ts', 'mail-search-route.test.ts', 'mail-send-idempotency.test.ts', 'model-probe-prompt-injection.test.ts', 'monitoring-alert-policy.test.ts', 'monitoring-case-events.test.ts', 'monitoring-case-notifications.test.ts', 'monitoring-cases.test.ts', 'monitoring-discord-alert.test.ts', 'monitoring-disk-diagnostics.test.ts', 'monitoring-issue-fingerprint.test.ts', 'monitoring-issues.test.ts', 'monitoring-message.test.ts', 'monitoring-retries.test.ts', 'native-logs.test.ts', 'organization-api-keys.test.ts', 'organization-builder-contract-equality.test.ts', 'organization-helper-lifecycle.test.ts', 'organization-helper-normalization.test.ts', 'organization-helper-watchlist-reference.test.ts', 'organization-invite-action-write.test.ts', 'organization-invite-projection.test.ts', 'organization-lifecycle.test.ts', 'organization-member-mutation-preflight.test.ts', 'organization-member-mutation-routes.test.ts', 'organization-membership-owner-count.test.ts', 'organization-page-session-cache.test.ts', 'organization-privacy-state.test.ts', 'organization-role-permissions.test.ts', 'organization-role-route-access.test.ts', 'organization-route-registration.test.ts', 'organization-watchlist-alert-blockers.test.ts', 'organization-watchlist-alert-export.test.ts', 'organization-watchlist-delivery-blockers.test.ts', 'organization-watchlist-denial-context.test.ts', 'organization-watchlist-export-lifecycle.test.ts', 'organization-watchlist-export.test.ts', 'organization-watchlist-query-filters.test.ts', 'organizations-watchlist-status-projection.test.ts', 'password-changed-mail.test.ts', 'password-policy.test.ts', 'postmaster-migration.test.ts', 'process-queue.test.ts', 'profile-ssh-keys.test.ts', 'public-api-contract-guard.test.ts', 'public-monitoring-policy.test.ts', 'public-monitoring-transport.test.ts', 'public-ti-v1-batch-client.test.ts', 'public-ti-v1-collections.test.ts', 'public-ti-v1-contract.test.ts', 'public-ti-v1-incident-metrics.test.ts', 'public-ti-v1-incidents.test.ts', 'public-ti-v1-search.test.ts', 'purge-deleted-accounts.test.ts', 'purge-user-ssh-keys.test.ts', 'push-monitoring-postgres.test.ts', 'push-monitoring.test.ts', 'rate-limit-admin-authorization.test.ts', 'rate-limit-transaction.test.ts', 'read-cache.test.ts', 'readiness-audit-retention.test.ts', 'record-monitor-result.test.ts', 'recovery-monitoring.test.ts', 'refresh-plugin-startup.test.ts', 'retention-precedence.test.ts', 'retention-prune-precedence.test.ts', 'rule-editing-analysis.test.ts', 'rule-editing-correlation.test.ts', 'rule-editing-counts.test.ts', 'rule-editing-lifecycle.test.ts', 'rule-editing-preview.test.ts', 'rule-editing-verified.test.ts', 'rule-hit-count-lock.test.ts', 'rule-list.test.ts', 'rule-preview.test.ts', 'rule-storage-estimate.test.ts', 'rules.test.ts', 'runtime-log-parsing.test.ts', 'secret-box.test.ts', 'security-rules.test.ts', 'service-account-scopes.test.ts', 'service-accounts.test.ts', 'service-check-case.test.ts', 'session-touch.test.ts', 'share-list-access.test.ts', 'share-save-ack.test.ts', 'shared-mail-access.test.ts', 'smtp-submission.test.ts', 'socket-message-text.test.ts', 'ssh-key-usage.test.ts', 'ssh-transport.test.ts', 'stalwart-admin.test.ts', 'status-cache.test.ts', 'status-handler-contract.test.ts', 'status-incidents.test.ts', 'status-load-payload.test.ts', 'status-presentation.test.ts', 'status-recovery.test.ts', 'stripe-webhook.test.ts', 'system-cron-cache.test.ts', 'system-cron-crontab.test.ts', 'system-cron-monitor-route.test.ts', 'system-cron-monitor.test.ts', 'system-cron-runtime-status.test.ts', 'system-event-bridge.test.ts', 'system-snapshot.test.ts', 'system-telemetry.test.ts', 'test-runner-policy.test.ts', 'thesis.test.mjs', 'ti-cached-search-timeout.test.ts', 'ti-internal-boundary.test.ts', 'ti-public-boundary.test.ts', 'ti-public-search-boundary.test.ts', 'ti-query-cache.test.ts', 'ti-query-classification.test.ts', 'ti-query-scraper-compatibility.test.ts', 'ti-saved-searches.test.ts', 'ti-scraper-control-actions.test.ts', 'ti-scraper-control-auth.test.ts', 'ti-scraper-control-read.test.ts', 'traffic-history-worker.test.ts', 'update-user-password.test.ts', 'user-email-access.test.ts', 'user-list-access.test.ts', 'user-password-routes.test.ts', 'verification-job-analysis.test.ts', 'verification-jobs.test.ts', 'verified-client-ip-flow.test.ts', 'vm-action-host-routing.test.ts', 'vm-action-status.test.ts', 'vm-active-organization-access.test.ts', 'vm-agent-target-handlers.test.ts', 'vm-agent-target-request.test.ts', 'vm-agent-target-sync-access.test.ts', 'vm-always-running.test.ts', 'vm-certificate-sync.test.ts', 'vm-connection.test.ts', 'vm-console-internal.test.ts', 'vm-console-restart.test.ts', 'vm-console.test.ts', 'vm-create-host-routing.test.ts', 'vm-deletion-mail.test.ts', 'vm-deletion.test.ts', 'vm-details-mapping.test.ts', 'vm-details-refresh.test.ts', 'vm-details-upsert.test.ts', 'vm-host-schema-release.test.ts', 'vm-host-transport-path.test.ts', 'vm-internal-provision.test.ts', 'vm-internal-status.test.ts', 'vm-lifecycle-monitor.test.ts', 'vm-lxd-provision-options.test.ts', 'vm-member-access.test.ts', 'vm-metrics-handlers.test.ts', 'vm-metrics-host-routing.test.ts', 'vm-metrics.test.ts', 'vm-nextjs-project.test.ts', 'vm-organization-inventory.test.ts', 'vm-organization.test.ts', 'vm-provision-rate-limit.test.ts', 'vm-public-ports.test.ts', 'vm-setup-plan.test.ts', 'vm-setup-user-data.test.ts', 'vm-share-management.test.ts', 'vm-status.test.ts', 'vm-sudo-password.test.ts', 'vm-system-status-host-routing.test.ts', 'vm-website.test.ts', 'web-scanner.test.ts', 'webhook-readiness-contract.test.ts'
    'uvm-finding-sync.test.ts',
    'uvm-network-scanner-client.test.ts',
    'uvm-run-reconciliation.test.ts',
    'uvm-scanner-workflow.test.ts',
    'uvm-scope.test.ts',
    'uvm-assessment.test.ts',
]

const databaseTestFiles = [
    'account-deletion-postgres.test.ts', 'automation-history.test.mjs', 'case-development-postgres.test.ts', 'monitoring-case-workflow-postgres.test.ts', 'monitoring-correlation-postgres.test.ts', 'log-phrase-search-postgres.test.ts', 'monitoring-issues-postgres.test.ts', 'monitoring-message-history-postgres.test.ts', 'monitoring-vm-access-postgres.test.ts', 'personal-automations-postgres.test.ts', 'schema-lock-timeout-postgres.test.ts', 'signup-verification-postgres.test.ts', 'vm-host-backfill-postgres.test.ts'

]

const postgresFilterTestFiles = [
    'account-deletion-purge-postgres.test.ts', 'analysis-policy-migration.test.ts', 'analyze-cdn-delivery-database.test.ts', 'analyze-cdn-delivery-reprocess.test.ts', 'analyze-cdn-refresh-database.test.ts', 'analyze-ingestion-database.test.ts', 'analyze-model-discovery-database.test.ts', 'analyze-postgres-database.test.ts', 'analyze-routine-groups-postgres.test.ts', 'builtin-reprocess-postgres.test.ts', 'existing-schema.test.ts', 'readiness-audit-database.test.ts', 'self-ingestion-proof-postgres.test.ts', 'ssh-transport-postgres.test.ts', 'verified-probe-activation-postgres.test.ts'

]

const categorizedFiles: Array<[UnitTestCategory, string[]]> = [
    ['unit', unitTestFiles],
    ['database', databaseTestFiles],
    ['postgresFilter', postgresFilterTestFiles],
]

const categoryByFile = new Map<string, UnitTestCategory>()
for (const [category, files] of categorizedFiles) {
    for (const file of files) {
        if (categoryByFile.has(file)) throw new Error(`API test suite has multiple runner categories: ${file}`)
        categoryByFile.set(file, category)
    }
}

export const classifiedUnitTestFiles = [...categoryByFile.keys()]
export const postgresFilterTestIds = postgresFilterTestFiles.map(file => file.replace(/\.test\.(ts|mjs)$/, ''))

export function classifyUnitTest(file: string) {
    const category = categoryByFile.get(file)
    if (!category) {
        throw new Error(`API test suite has no runner category: ${file}. Add it to test-runner-policy.ts.`)
    }

    const requiresPostgresFilterPort = category === 'postgresFilter'
    return {
        requiresDatabase: category === 'database' || requiresPostgresFilterPort,
        requiresPostgresFilterPort,
    }
}

export function isTaskEnabledByDefault(
    requires: 'server' | 'database' | 'network' | 'playwright' | undefined,
    environment: Record<string, string | undefined>,
) {
    if (requires === 'database') return environment.RUN_DB_TESTS === '1'
    if (requires === 'server') return environment.RUN_SERVER_TESTS === '1'
    if (requires === 'network') return environment.RUN_NETWORK_TESTS === '1'
    if (requires === 'playwright') return environment.RUN_E2E === '1' || environment.RUN_PLAYWRIGHT === '1'
    return true
}

export type RunnerTask = {
    id: string
    requires?: 'server' | 'database' | 'network' | 'playwright'
    requiresDatabase?: boolean
    requiresPostgresFilterPort?: boolean
}

export function getDatabaseRunNotice(tasks: readonly RunnerTask[], databaseModeEnabled: boolean) {
    const databaseTasks = tasks.filter(task => task.requires === 'database' || task.requiresDatabase || task.requiresPostgresFilterPort)
    if (databaseModeEnabled || databaseTasks.length === 0) return null
    const filterTaskCount = databaseTasks.filter(task => task.requiresPostgresFilterPort).length

    return [
        `Excluded database-required suites (${databaseTasks.length}; not run in this default run): ${databaseTasks.map(task => task.id).join(', ')}.`,
        'Set RUN_DB_TESTS=1 to include database-required suites.',
        ...(filterTaskCount > 0 ? [
            `The ${filterTaskCount} PostgreSQL-filter suites also require POSTGRES_FILTER_TEST_PORT to point to a disposable local PostgreSQL instance with a postgres_filter_test database; run bun run test:postgres-filter for that group.`,
        ] : []),
    ].join('\n')
}

export function getPostgresFilterPortError(tasks: readonly RunnerTask[], port: string | undefined) {
    const selectedFilterTasks = tasks.filter(task => task.requiresPostgresFilterPort)
    if (selectedFilterTasks.length === 0 || isValidPostgresPort(port)) return null

    return [
        `PostgreSQL-filter test task${selectedFilterTasks.length === 1 ? '' : 's'} selected: ${selectedFilterTasks.map(task => task.id).join(', ')}.`,
        'Set POSTGRES_FILTER_TEST_PORT to the port (1024-65535) of a disposable local PostgreSQL instance with a postgres_filter_test database.',
        'This preflight validates the port value only; it does not connect to PostgreSQL.',
    ].join('\n')
}

function isValidPostgresPort(port: string | undefined) {
    if (!port || !/^\d+$/.test(port)) return false
    const value = Number(port)
    return Number.isInteger(value) && value >= 1024 && value <= 65535
}
