import assert from 'node:assert/strict'

// This test creates fixtures. Never run against a normal or persistent database.
assert.equal(process.env.RUN_PRIVACY_COUNT_DB_TESTS, '1')
assert.equal(process.env.DB, 'privacy_count_test')
assert.equal(process.env.DB_HOST, 'privacy-count-db')
assert.equal(process.env.DB_POOL_HOST || '', '')
assert.equal(process.env.HANASAND_IDENTITY_FDW_HOST || '', '')
const { mock } = await import('bun:test')
// Authentication is covered separately. Exercise the actual GET handler and
// membership SQL using synthetic authentication, without production sessions.
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'fixture-user' }) }))
const { queryOnce, closeDatabase } = await import('../src/utils/db.ts')
const { readImmutableOrganizationLogCount } = await import('../src/utils/organizationPrivacyLogCount.ts')
const { getOrganizationPrivacy } = await import('../src/handlers/organizationPrivacy.ts')
const { default: Fastify } = await import('fastify')
const { default: pg } = await import('pg')
const fixtures = new pg.Pool({ host: process.env.DB_HOST, port: 5432, database: 'privacy_count_test', user: process.env.DB_USER, password: process.env.DB_PASSWORD, max: 1 })
const app = Fastify({ logger: false })
let assertions = 0
const equal = (actual: unknown, expected: unknown) => { assert.deepEqual(actual, expected); assertions++ }
try {
    await fixtures.query(`CREATE TABLE users(id TEXT PRIMARY KEY, active BOOLEAN);
        CREATE TABLE organizations(id TEXT PRIMARY KEY,name TEXT,status TEXT,retention_days INT,updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE organization_members(organization_id TEXT,user_id TEXT,status TEXT,role TEXT);
        CREATE TABLE organization_retention_runs(id TEXT,organization_id TEXT,created_at TIMESTAMPTZ DEFAULT NOW(),status TEXT);
        CREATE TABLE organization_privacy_requests(id TEXT,organization_id TEXT,requested_at TIMESTAMPTZ DEFAULT NOW(),status TEXT);
        CREATE TABLE organization_retention_run_items(run_id TEXT,organization_id TEXT,status TEXT,processed_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE admin_access_recovery_approvals(organization_id TEXT);
        CREATE TABLE system_events(organization_id TEXT);
        CREATE TABLE dwm_webhook_audit_events(org_id TEXT);
        CREATE TABLE events(id TEXT,organization_id TEXT,ingestion_id TEXT,normalized JSONB);
        INSERT INTO users VALUES ('fixture-user',TRUE);
        INSERT INTO organizations(id,name,status,retention_days) VALUES ('fixture-org','Synthetic organization','active',30);
        INSERT INTO organization_members VALUES ('fixture-org','fixture-user','active','owner');
        INSERT INTO organization_retention_runs VALUES ('fixture-run','fixture-org',NOW(),'completed');
        INSERT INTO organization_privacy_requests VALUES ('fixture-request','fixture-org',NOW(),'completed');
        INSERT INTO organization_retention_run_items VALUES ('fixture-run','fixture-org','protected',NOW());
        INSERT INTO admin_access_recovery_approvals VALUES ('fixture-org');
        INSERT INTO system_events VALUES ('fixture-org');
        INSERT INTO dwm_webhook_audit_events VALUES ('fixture-org');
        INSERT INTO events VALUES
          ('metadata-owner','different-row-org','logs','{"metadata":{"organizationId":"fixture-org"}}'),
          ('metadata-tenant','different-row-org','logs','{"metadata":{"tenantId":"fixture-org"}}'),
          ('both-once','fixture-org','logs','{"metadata":{"organizationId":"fixture-org","tenantId":"fixture-org"}}'),
          ('other-org','fixture-org','logs','{"metadata":{"organizationId":"different-org"}}'),
          ('not-logs','fixture-org','other','{"metadata":{"organizationId":"fixture-org"}}');`)
    equal(await readImmutableOrganizationLogCount('fixture-org'), { value: 3, available: true })
    equal(await readImmutableOrganizationLogCount('empty-org'), { value: 0, available: true })
    app.get('/api/organizations/:id/privacy', getOrganizationPrivacy)
    await app.listen({ host: '127.0.0.1', port: 0 })
    const port = (app.server.address() as { port: number }).port
    const read = () => fetch(`http://127.0.0.1:${port}/api/organizations/fixture-org/privacy`)
    const fast = await read(), fastBody = await fast.json() as Record<string, any>
    equal(fast.status, 200)
    equal(fastBody.protection.immutable_log_events, 3)
    equal(fastBody.protection.immutable_log_events_available, true)
    equal(fastBody.warnings, [])
    // Volatile predicate forces server-side work beyond the750ms budget.
    // Installed only in this disposable synthetic database.
    await fixtures.query(`ALTER TABLE events RENAME TO fixture_events;
        CREATE VIEW events AS SELECT * FROM fixture_events WHERE pg_sleep(2) IS NOT NULL`)
    const started = performance.now()
    const slow = await read(), slowBody = await slow.json() as Record<string, any>
    const elapsed = performance.now() - started
    equal(slow.status, 200)
    equal(slowBody.protection.immutable_log_events, null)
    equal(slowBody.protection.immutable_log_events_available, false)
    equal(slowBody.protection.immutable_log_events_unavailable_reason, 'timeout')
    equal(slowBody.protection.protected_events, 1)
    equal(slowBody.protection.access_recovery_holds, 1)
    equal(slowBody.organization.retention_days, 30)
    equal(slowBody.runs.length, 1)
    equal(slowBody.requests.length, 1)
    equal(slowBody.items.length, 1)
    equal(slowBody.permissions, fastBody.permissions)
    equal(slowBody.warnings.length, 1)
    assert(elapsed >= 650 && elapsed < 2500, `Expected a bounded cancelled read, got ${Math.round(elapsed)}ms`); assertions++
    const active = await queryOnce(`SELECT count(*)::int AS active FROM pg_stat_activity
        WHERE pid<>pg_backend_pid() AND datname=current_database() AND state='active'
          AND query LIKE '%AS immutable_log_events%'`)
    equal(active.rows[0].active, 0)
    equal((await queryOnce('SHOW transaction_read_only')).rows[0].transaction_read_only, 'off')
    assert.notEqual((await queryOnce('SHOW statement_timeout')).rows[0].statement_timeout, '750ms'); assertions++
    await fixtures.query('DROP VIEW events')
    await assert.rejects(() => readImmutableOrganizationLogCount('fixture-org'), (error: { code?: string }) => error.code === '42P01'); assertions++
    console.log(`Privacy count PostgreSQL/registered HTTP route: ${assertions} assertions passed; cancelled slow metric in ${Math.round(elapsed)}ms; no lingering count query.`)
} finally {
    await app.close()
    await closeDatabase()
    await fixtures.end()
}
