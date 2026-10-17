import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mock } from 'bun:test'
import type { LogPipelinePostgresContext } from './logPipelinePostgresContext.ts'

export async function runLogPipelineStandbyPermissionChecks(context: LogPipelinePostgresContext) {
    const { query, installEnsureSchemaTables } = context
    // Apply the committed standby SELECT block to isolated temporary relations.
    // Authentication is mocked; the actual handlers and SQL run under an unprivileged role.
    const permissions = readFileSync(new URL('../../db/standby-permissions.sql', import.meta.url), 'utf8')
    const logsGrant = permissions.match(/-- Administrator-only Logs pages[^\n]*\n(GRANT SELECT[\s\S]*?;)/)?.[1]
    assert.ok(logsGrant, 'The explicit standby Logs grant must exist')
    const logTables = ['service_logs', 'traffic_events', 'events', 'log_processing_cursors', 'log_catchup_progress', 'log_process_queue', 'log_dimensions', 'log_dimensions_state', 'log_counts', 'log_counts_state']
    assert.deepEqual([...logsGrant.matchAll(/public\.(\w+)/g)].map(match => match[1]), logTables)
    const navigationGrant = permissions.match(/-- Organization selector[^\n]*\n(GRANT SELECT[\s\S]*?;)/)?.[1]
    assert.ok(navigationGrant, 'The explicit standby organization/Traffic read grant must exist')
    const navigationTables = ['organization_invites', 'traffic_aggregate_events']
    assert.deepEqual([...navigationGrant.matchAll(/public\.(\w+)/g)].map(match => match[1]), navigationTables)
    await query('ALTER TABLE organizations ADD COLUMN updated_at timestamptz DEFAULT NOW()')
    await query('ALTER TABLE users ADD COLUMN active boolean NOT NULL DEFAULT true')
    await installEnsureSchemaTables(import.meta.url, query, ['organization_members', 'organization_invites', 'organization_watchlist_items'], { temporary: true })
    await query('INSERT INTO users(id) VALUES (\'permission-user\')')
    await query('INSERT INTO organization_members(organization_id,user_id,role) VALUES (\'fixture\',\'permission-user\',\'owner\')')
    await query(`INSERT INTO organization_invites(organization_id,email,invited_by,expires_at)
        VALUES ('fixture','pending@example.test','permission-user',NOW()+INTERVAL '1 day'),
            ('fixture','expired@example.test','permission-user',NOW()-INTERVAL '1 day')`)
    const historySchema = readFileSync(new URL('../src/utils/traffic/history.ts', import.meta.url), 'utf8')
    for (const table of ['traffic_history_state', 'traffic_history']) {
        const definition = historySchema.match(new RegExp('CREATE TABLE IF NOT EXISTS ' + table + ' \\([\\s\\S]*?\\n        \\)'))?.[0]
        assert.ok(definition, `Actual schema for ${table} must be found`)
        await query(definition.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE'))
    }
    const { ensureTrafficHistorySchema } = await import('../src/utils/traffic/history.ts')
    await ensureTrafficHistorySchema()
    assert.equal((await query('SELECT relpersistence FROM pg_class WHERE oid=\'traffic_aggregate_events\'::regclass')).rows[0].relpersistence, 't', 'Aggregate view and every fixture relation stay temporary')
    const reader = `logs_reader_${crypto.randomUUID().replaceAll('-', '')}`
    const temporarySchema = (await query('SELECT nspname FROM pg_namespace WHERE oid=pg_my_temp_schema()')).rows[0].nspname
    assert.match(temporarySchema, /^pg_temp_\d+$/)
    await query(`CREATE ROLE ${reader} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`)
    await query(`GRANT USAGE ON SCHEMA ${temporarySchema} TO ${reader}`)
    // These reads already belong to the existing standby policy.
    await query(`GRANT SELECT ON pg_temp.organizations, pg_temp.login_events, pg_temp.users, pg_temp.organization_members, pg_temp.organization_watchlist_items TO ${reader}`)
    await query(`SET LOCAL ROLE ${reader}`)
    await query('SAVEPOINT denied_log_read')
    await assert.rejects(query('SELECT id FROM service_logs LIMIT 1'), { code: '42501' })
    await query('ROLLBACK TO SAVEPOINT denied_log_read')
    for (const table of navigationTables) {
        await query('SAVEPOINT denied_navigation_read')
        await assert.rejects(query(`SELECT 1 FROM ${table} LIMIT 1`), { code: '42501' })
        await query('ROLLBACK TO SAVEPOINT denied_navigation_read')
    }
    await query('RESET ROLE')
    await query(navigationGrant.replaceAll('public.', 'pg_temp.').replace('hanasand_standby_app', reader))
    await query(logsGrant.replaceAll('public.', 'pg_temp.').replace('hanasand_standby_app', reader))
    await query('UPDATE organizations SET status=\'archived\' WHERE id=\'other\'')
    await query(`INSERT INTO events (id, ingestion_id, organization_id, event_timestamp, processing_status, normalized)
        VALUES ('permission-active','logs','fixture',NOW(),'processed','{"severity":"high","service":"standby-fixture","log_type":"ProcessLogs","message":"standby permission fixture"}'),
            ('permission-inactive','logs','other',NOW(),'processed','{"severity":"critical","service":"standby-fixture","log_type":"ProcessLogs","message":"standby permission fixture"}')`)
    await query(`INSERT INTO service_logs (service,level,message,metadata) VALUES ('standby-fixture','error','standby permission fixture',
        '{"category":"http_response_error","surface":"api","status_code":500,"error_code":"fixture","error_message":"fixture","path":"/fixture","user_agent":"fixture"}')`)
    await query('INSERT INTO traffic_events (path,method,status,user_agent) VALUES (\'/standby-permission\',\'GET\',503,\'fixture\')')
    await query('INSERT INTO login_events (user_id,ip,status,reason) VALUES (\'permission-user\',\'192.0.2.1\',\'failure\',\'bad_password\')')
    let authorized = true, administrator = true, reads = 0
    mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: authorized, id: 'permission-user' }) }))
    mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({ default: async () => ({ valid: administrator }) }))
    mock.module('../src/utils/logs/native.ts', () => ({ listNativeLogs: async () => [], listNativeLogServices: async () => [], isNativeLogSourceAvailable: () => false }))
    mock.module('../src/utils/docker/engine.ts', () => ({ listRuntimeLogs: async () => ({ logs: [], containers: [] }), isRuntimeLogSourceAvailable: () => false }))
    const { default: Fastify } = await import('fastify')
    const { searchLogs } = await import('../src/handlers/logs/search.ts')
    const { getLogs, getLogServices } = await import('../src/handlers/logs/get.ts')
    const { getErrorEvents } = await import('../src/handlers/logs/errors.ts')
    const { getOrganizations } = await import('../src/handlers/organizations.ts')
    const { getLegacyTrafficSummary, getLegacyTrafficRecords } = await import('../src/handlers/traffic/legacy.ts')
    const app = Fastify()
    app.get('/organizations', getOrganizations)
    app.get('/traffic/summary', getLegacyTrafficSummary)
    app.get('/traffic/records', getLegacyTrafficRecords)
    app.get('/logs/search', searchLogs)
    app.get('/logs', getLogs)
    app.get('/logs/services', getLogServices)
    app.get('/logs/errors', getErrorEvents)
    await query(`SET LOCAL ROLE ${reader}`)
    context.queryObserver = async () => { reads++ }
    try {
        const organizations = await app.inject('/organizations')
        assert.equal(organizations.statusCode, 200, organizations.body)
        assert.deepEqual(organizations.json().organizations.map((row: { id: string, pendingInviteCount: number }) => [row.id, row.pendingInviteCount]), [['fixture', 1]], 'Membership and pending/unexpired invitation counts remain enforced')
        for (const path of ['/traffic/summary?metric=path', '/traffic/records']) {
            const response = await app.inject(path)
            assert.equal(response.statusCode, 200, response.body)
            if (path.includes('summary')) assert.ok(response.json().some((row: { value: string }) => row.value === '/standby-permission'))
            else assert.ok(response.json().result.length && response.json().total > 0)
        }
        const search = '/logs/search?service=standby-fixture&stats=1'
        for (const suffix of ['', '&severity=high,critical', '&search=standby', `&kql=${encodeURIComponent('ProcessLogs | where Message contains "standby" | take 100')}`]) {
            const response = await app.inject(search + suffix)
            assert.equal(response.statusCode, 200, response.body)
            const body = response.json()
            assert.deepEqual(body.rows.map((row: {id: string}) => row.id), ['permission-active'], 'Inactive organizations stay excluded under the standby role')
            assert.deepEqual(body.counts, [{ severity: 'high', count: 1 }])
            assert.deepEqual(body.services, [{ service: 'standby-fixture', count: 1 }])
            assert.ok(body.processing.sources.length)
            assert.equal(typeof body.processing.pending_commands.count, 'number')
        }
        for (const url of ['/logs?service=standby-fixture', '/logs/services', '/logs/errors?includeExpected=1']) {
            const response = await app.inject(url)
            assert.equal(response.statusCode, 200, response.body)
            if (url.includes('errors')) assert.ok(['api', 'auth', 'traffic'].every(source => response.json().errors.some((row: {source: string}) => row.source === source)))
            else if (url.includes('services')) assert.ok(response.json().services.some((row: {service: string}) => row.service === 'standby-fixture'))
            else assert.ok(response.json().logs.length)
        }
        for (const url of [search, '/logs', '/logs/services', '/logs/errors']) {
            const before = reads
            authorized = false
            assert.equal((await app.inject(url)).statusCode, 401)
            authorized = true
            administrator = false
            assert.equal((await app.inject(url)).statusCode, 403)
            administrator = true
            assert.equal(reads, before, 'Denied users never reach SQL or cached log data')
        }
        for (const table of [...logTables, ...navigationTables]) {
            const privileges = (await query(`SELECT has_table_privilege(current_user,$1,'SELECT') AS readable,
                has_table_privilege(current_user,$1,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS writable`, [`pg_temp.${table}`])).rows[0]
            assert.deepEqual(privileges, { readable: true, writable: false }, table)
        }
        for (const table of ['findings', 'rules', 'system_events', 'traffic_history', 'traffic_history_state']) {
            assert.equal((await query('SELECT has_table_privilege(current_user,$1,\'SELECT\') AS allowed', [`pg_temp.${table}`])).rows[0].allowed, false, 'No unrelated table access')
        }
        assert.equal((await query('SELECT has_schema_privilege(current_user,$1,\'CREATE\') AS allowed', ['public'])).rows[0].allowed, false)
        const flags = (await query('SELECT rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0]
        assert.ok(Object.values(flags).every(value => value === false))
        for (const sql of ['UPDATE events SET normalized=\'{}\' WHERE FALSE', 'DELETE FROM service_logs WHERE FALSE', 'DELETE FROM organization_invites WHERE FALSE', 'UPDATE traffic_history_state SET covered_before=NOW() WHERE FALSE', 'CREATE TABLE public.forbidden_logs_ddl (id int)']) {
            await query('SAVEPOINT denied_log_write')
            await assert.rejects(query(sql), { code: '42501' })
            await query('ROLLBACK TO SAVEPOINT denied_log_write')
        }
    } finally {
        context.queryObserver = undefined
        await query('RESET ROLE')
        await app.close()
    }
    console.log('PostgreSQL standby permissions passed: exact SELECT grants, actual organization/Traffic/Logs/search/counters/errors readers, active organization filtering, 401/403 before reads, no added writes or DDL.')
}
