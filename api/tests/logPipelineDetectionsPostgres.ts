import assert from 'node:assert/strict'
import type { LogPipelinePostgresContext } from './logPipelinePostgresContext.ts'

export async function runLogPipelineDetectionChecks(context: LogPipelinePostgresContext) {
    const { query, processLogBatch, rules, time, rows, BUILTIN_RULES, defaultRuleDefinition, createFindings, normalizeEvent,
        securityRules, compileLogQuery } = context
    const detectionUpdates: Array<{ sql: string, values: unknown[] }> = []
    context.queryObserver = async (sql, values) => {
        if (sql.startsWith('UPDATE events e SET normalized')) detectionUpdates.push({ sql, values })
    }
    await processLogBatch(rows, 'fixture', rules)
    context.queryObserver = undefined
    assert.equal(detectionUpdates.length, 0, 'Stateless detections must finish without a second event/index write')
    const restricted = await query('SELECT COUNT(*)::int AS count FROM findings WHERE evidence->>\'restrictedLog\' IS DISTINCT FROM \'true\'')
    assert.equal(restricted.rows[0].count, 0, 'Every collected-log finding must carry the durable administrator-only flag')
    for (const rule of securityRules) {
        for (const positive of [true, false]) {
            const { rows: [row] } = await query('SELECT * FROM events WHERE log_key = $1', [`service:${rule.id}-${positive}`])
            assert.equal(row.processing_status, 'processed')
            assert.equal(row.normalized.level, 'info')
            assert.equal(row.normalized.detections.some((match: { rule_id: string }) => match.rule_id === rule.id), positive, `${rule.id} ${positive}`)
        }
    }
    const cleanWrites: string[] = []
    context.queryObserver = async sql => { if (/^(INSERT INTO events|UPDATE events)/.test(sql.trim())) cleanWrites.push(sql) }
    await processLogBatch([{ id: 'single-write-http', service: 'http-traffic', host: 'fixture.test', level: 'info',
        message: 'GET /help → 200', created_at: new Date(time).toISOString(), metadata: { category: 'http' } }], 'fixture', rules)
    context.queryObserver = undefined
    assert.equal(cleanWrites.length, 1, 'Clean stateless events finish in one durable write')
    const clean = (await query('SELECT normalized, processing_status FROM events WHERE log_key=\'service:single-write-http\'')).rows[0]
    assert.equal(clean.processing_status, 'processed')
    assert.equal(clean.normalized.rules_checked, rules.length)
    assert.deepEqual(clean.normalized.detections, [])
    const projectionLock = (await query('SELECT xmax::text FROM log_dimensions WHERE event_id=(SELECT id FROM events WHERE log_key=\'service:single-write-http\')')).rows[0].xmax
    await query('UPDATE events SET normalized=normalized||jsonb_build_object(\'evaluated_at\',clock_timestamp()) WHERE log_key=\'service:single-write-http\'')
    assert.equal((await query('SELECT xmax::text FROM log_dimensions WHERE event_id=(SELECT id FROM events WHERE log_key=\'service:single-write-http\')')).rows[0].xmax,
        projectionLock, 'An evidence-only update must not lock or rewrite the unchanged reporting projection')

    // Enable real rollback for this failure fixture. The broader cursor suite
    // shares one outer transaction and deliberately interleaves background work.
    context.atomicTransactions = true
    const atomicLog = { ...rows[0], id: 'atomic-stateless-failure' }
    const atomicId = createHash('sha256').update(`service:${atomicLog.id}`).digest('hex')
    await query(`CREATE FUNCTION pg_temp.reject_atomic_finding() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.event_ids @> ARRAY['${atomicId}'] THEN RAISE EXCEPTION 'injected finding failure'; END IF; RETURN NEW; END $$`)
    await query('CREATE TRIGGER reject_atomic_finding BEFORE INSERT ON findings FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_atomic_finding()')
    await assert.rejects(processLogBatch([atomicLog], 'fixture', rules), /injected finding failure/)
    assert.equal((await query('SELECT count(*)::int AS count FROM events WHERE id=$1', [atomicId])).rows[0].count, 0,
        'A failed finding write must not publish a processed event')
    assert.equal((await query('SELECT count(*)::int AS count FROM findings WHERE event_ids @> ARRAY[$1]', [atomicId])).rows[0].count, 0)
    await query('DROP TRIGGER reject_atomic_finding ON findings')
    await processLogBatch([atomicLog], 'fixture', rules)
    const retriedAtomic = (await query('SELECT processing_status,normalized FROM events WHERE id=$1', [atomicId])).rows[0]
    assert.equal(retriedAtomic.processing_status, 'processed')
    assert.ok(retriedAtomic.normalized.detections.length)
    assert.ok(retriedAtomic.normalized.detections.every((finding: any) => finding.evidence.restrictedLog === true))

    context.atomicTransactions = false
    const before = Number((await query('SELECT count(*) AS count FROM findings')).rows[0].count)
    await processLogBatch(rows, 'fixture', rules)
    assert.equal(Number((await query('SELECT count(*) AS count FROM findings')).rows[0].count), before, 'Retry must not duplicate findings')

    const auth = (id: string, user: string, outcome: string, second: number) => ({ id, service: 'sshd', host: 'fixture-host', level: 'info',
        message: `${outcome === 'success' ? 'Accepted' : 'Failed'} password for ${user} from 192.0.2.10 port 22 ssh2`,
        created_at: new Date(time + second * 1000).toISOString(), metadata: {} })
    context.queryObserver = async (sql, values) => { if (sql.startsWith('UPDATE events e SET normalized')) detectionUpdates.push({ sql, values }) }
    await processLogBatch([auth('failed-a', 'alice', 'failure', 1), auth('failed-b', 'alice', 'failure', 2),
        auth('failed-c', 'alice', 'failure', 3), auth('success-a', 'alice', 'success', 4),
        auth('spray-b', 'bob', 'failure', 5), auth('spray-c', 'charlie', 'failure', 6)], 'fixture', rules)
    context.queryObserver = undefined
    const detectionUpdate = detectionUpdates.at(-1)
    assert.ok(detectionUpdate)
    assert.equal((await query(detectionUpdate.sql, detectionUpdate.values)).rowCount, 0,
        'Identical authentication detection updates must not rewrite events or their indexes')
    for (const id of ['auth.brute_force_success.v1', 'auth.password_spray.v1']) {
        assert.ok((await query('SELECT 1 FROM findings WHERE rule_id = $1', [id])).rowCount, `${id} real SQL correlation`)
    }
    const { rows: [authRow] } = await query('SELECT source_ip, normalized FROM events WHERE log_key = \'service:success-a\'')
    assert.equal(authRow.source_ip, '192.0.2.10')
    assert.equal(authRow.normalized.severity, 'high')

    await processLogBatch([auth('late-success', 'late-user', 'success', 30)], 'fixture', rules)
    const lateFailures = [auth('late-failure-a', 'late-user', 'failure', 21), auth('late-failure-b', 'late-user', 'failure', 22), auth('late-failure-c', 'late-user', 'failure', 23)]
    await processLogBatch(lateFailures, 'fixture', rules)
    const { rows: [lateSuccess] } = await query('SELECT normalized FROM events WHERE log_key = \'service:late-success\'')
    assert.equal(lateSuccess.normalized.severity, 'high', 'Late historical failures must update the previously processed success')
    assert.ok(lateSuccess.normalized.detections.some((finding: {rule_id: string}) => finding.rule_id === 'auth.brute_force_success.v1'))
    const lateCount = Number((await query('SELECT count(*) AS count FROM findings')).rows[0].count)
    await processLogBatch(lateFailures, 'fixture', rules)
    assert.equal(Number((await query('SELECT count(*) AS count FROM findings')).rows[0].count), lateCount)

    // Original non-process rules run against persisted native Event events too.
    async function native(id: string, content: Record<string, unknown>, second: number) {
        const event = normalizeEvent({ ...content, timestamp: new Date(time + second * 1000).toISOString() }, {})
        await query(`INSERT INTO events (id, ingestion_id, organization_id, event_timestamp, event_type, action, outcome,
            user_id, source_ip, source_country, normalized) VALUES ($1, 'fixture', 'fixture', $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, event.timestamp, event.eventType, event.action, event.outcome, event.userId, event.sourceIp, event.sourceCountry, JSON.stringify(event.normalized)])
        await createFindings('fixture', id, event, rules)
    }
    await native('country-a', { event_type: 'authentication', action: 'login', outcome: 'success', user: { id: 'traveller' },
        source: { country: 'NO', latitude: 59.9, longitude: 10.7 }, device: { id: 'one' } }, 1)
    await native('country-b', { event_type: 'authentication', action: 'login', outcome: 'success', user: { id: 'traveller' },
        source: { country: 'US', latitude: 40.7, longitude: -74 }, device: { id: 'two' } }, 2)
    await native('network', { event_type: 'network', action: 'alert', signature: 'Fixture signature' }, 3)
    await native('vulnerability', { event_type: 'vulnerability', cve: 'CVE-2026-12345', asset: { id: 'fixture-host', version: '1' } }, 4)
    // Pre-storage Analyze rules have their own threshold/retention integration
    // check; a single stored fixture must not trigger their aggregate alert.
    for (const rule of BUILTIN_RULES.filter(rule => defaultRuleDefinition(rule.id).stage !== 'analyze')) assert.ok((await query('SELECT 1 FROM findings WHERE rule_id = $1', [rule.id])).rowCount, `Persisted finding for ${rule.id}`)
    for (const text of ['ProcessLogs | where Executable endswith "whoami"', 'SigninLogs | where Severity == "high"',
        'Logs | where RuleId == "process.recon.whoami.v1"', 'Logs | where Message contains "whoami"']) {
        const compiled = compileLogQuery(text)
        const result = await query(`SELECT id FROM events WHERE ${compiled.where.join(' AND ')} ORDER BY ${compiled.order} LIMIT ${compiled.limit}`, compiled.params)
        assert.ok(result.rowCount, `KQL returned stored events: ${text}`)
    }
    await query('CREATE TEMP TABLE log_processing_cursors (name text PRIMARY KEY, last_id bigint DEFAULT 0, recent_id bigint, updated_at timestamptz DEFAULT NOW(), last_error text)')
    const { logCatchupSchema } = await import('../src/utils/db/logCatchupSchema.ts')
    for (const statement of logCatchupSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    const { logProcessQueueSchema, processLogIndex } = await import('../src/utils/db/logProcessQueueSchema.ts')
    for (const statement of logProcessQueueSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    await query(processLogIndex)
    await query('INSERT INTO login_events (user_id, ip, status, reason) VALUES (\'web-user\', \'192.0.2.55\', \'failed\', \'bad_password\')')
    await query('INSERT INTO traffic_events (domain, path, method, status) VALUES (\'hanasand.com\', \'/fixture\', \'GET\', 503)')
    await query('INSERT INTO system_events (event_type, severity, organization_id) VALUES (\'fixture.audit\', \'critical\', \'fixture\')')
    const { processAdditionalLogSources } = await import('../src/utils/events/storedSources.ts')
    await processAdditionalLogSources(logs => processLogBatch(logs, 'fixture', rules))
    for (const [source, type, severity] of [['login_events', 'SigninLogs', 'low'], ['traffic_events', 'HttpLogs', 'high'], ['system_events', 'SystemLogs', 'critical']]) {
        const { rows: [event] } = await query('SELECT normalized FROM events WHERE log_key = $1', [`service:${source}:1`])
        assert.equal(event.normalized.log_type, type)
        assert.equal(event.normalized.severity, severity)
    }
}
