import assert from 'node:assert/strict'
import type { LogPipelinePostgresContext } from './logPipelinePostgresContext.ts'

export async function runLogPipelineQueueChecks(context: LogPipelinePostgresContext) {
    const { query, client, processLogBatch, processStoredLogs, rules, logProcessQueueSchema } = context
    // A replayed collector batch must not hide newly executed commands behind its
    // FIFO. Use the actual priority SQL, processor, configured rules and cursors.
    await query(`INSERT INTO service_logs (service, host, level, message, created_at)
        SELECT 'fixture', 'fixture-host', 'info', 'Historical replay', NOW() - INTERVAL '1 hour'
        FROM generate_series(1, 1101)`)
    const commandMetadata = { process: { executable: '/usr/bin/whoami', command_line: 'whoami', arguments: ['whoami'] } }
    const insertCommand = `INSERT INTO service_logs (service, host, level, message, metadata)
        VALUES ('audit', 'fixture-host', 'info', 'whoami', $1) RETURNING id::text`
    const liveId = (await query(insertCommand, [commandMetadata])).rows[0].id
    await query('INSERT INTO log_processing_cursors (name, last_id, recent_id) VALUES (\'service_logs\', 0, 0)')
    let afterWatermarkId = '', observedPriorityBeforeFifo = false
    context.queryObserver = async (sql, values) => {
        if (sql.includes('SELECT s.* FROM service_logs s') && !afterWatermarkId) {
            assert.equal(values.length, 0, 'Priority reads visible rows without advancing a sequence cursor')
            afterWatermarkId = (await client.query(insertCommand, [commandMetadata])).rows[0].id
        }
        if (sql.includes('SELECT * FROM service_logs') && String(values[0]) === '0' && String(values[1]) === liveId) {
            const priority = await client.query('SELECT processing_status, normalized FROM events WHERE log_key = $1', [`service:${liveId}`])
            assert.equal(priority.rows[0]?.processing_status, 'processed', 'Live command completes before older FIFO logs are read')
            assert.equal(priority.rows[0].normalized.severity, 'high')
            observedPriorityBeforeFifo = true
        }
    }
    const previousPlatform = process.env.PLATFORM_LOG_ORGANIZATION_ID
    process.env.PLATFORM_LOG_ORGANIZATION_ID = 'fixture'
    try {
        await processStoredLogs()
        context.queryObserver = undefined
        assert.ok(observedPriorityBeforeFifo)
        const firstCursor = (await query('SELECT last_id, recent_id FROM log_processing_cursors WHERE name = \'service_logs\'')).rows[0]
        assert.equal(String(firstCursor.recent_id), '1000', 'Priority cannot jump the FIFO checkpoint')
        assert.equal(String(firstCursor.last_id), '0')
        assert.equal((await query('SELECT processing_status FROM events WHERE log_key = $1', [`service:${afterWatermarkId}`])).rows[0]?.processing_status, 'processed',
            'A visible insertion after the watermark is processed without moving the FIFO cursor past that watermark')
        await processStoredLogs()
        const findingCount = (await query('SELECT count(*)::int AS count FROM findings')).rows[0].count
        await processStoredLogs()
        assert.equal((await query('SELECT count(*)::int AS count FROM findings')).rows[0].count, findingCount,
            'Later FIFO and historical overlap must not duplicate priority findings')
        assert.equal((await query(`SELECT count(*)::int AS count FROM service_logs s
            JOIN events e ON e.log_key = 'service:' || s.id::text WHERE e.processing_status = 'processed'`)).rows[0].count, 1103,
        'Priority and both cursors together preserve every old and live event')
        const commandEvents = await query('SELECT normalized FROM events WHERE log_key = ANY($1::text[])', [[`service:${liveId}`, `service:${afterWatermarkId}`]])
        assert.equal(commandEvents.rowCount, 2)
        assert.ok(commandEvents.rows.every(event => event.normalized.detections.some((finding: { rule_id: string }) => finding.rule_id === 'process.recon.whoami.v1')))
    } finally {
        context.queryObserver = undefined
        if (previousPlatform === undefined) delete process.env.PLATFORM_LOG_ORGANIZATION_ID
        else process.env.PLATFORM_LOG_ORGANIZATION_ID = previousPlatform
    }
    console.log('PostgreSQL worker verification passed: live priority before replay, stable watermark bounds, complete FIFO catch-up and finding deduplication.')
    // Upgrade fixture: pre-existing process events were never admitted to the
    // new queue. A fixed recovery snapshot must reach an aged command even as
    // newer commands continue arriving through the trigger.
    const { acknowledgeProcessedLogs, processQueuedLogs, recoverProcessLogs, readPendingProcessLogs } = await import('../src/utils/events/processQueue.ts')
    await query('DROP TRIGGER log_process_queue_insert ON service_logs')
    const oldCommand = (await query(`INSERT INTO service_logs (service, host, level, message, metadata, created_at)
        VALUES ('audit', 'old-vm', 'info', 'whoami', $1, NOW() - INTERVAL '2 hours') RETURNING id::text`, [commandMetadata])).rows[0].id
    const benignProcess = { process: { executable: '/bin/true', command_line: 'true', arguments: ['true'] } }
    await query(`INSERT INTO service_logs (service, host, level, message, metadata, created_at)
        SELECT 'audit', 'old-host', 'info', 'true', $1, NOW() - INTERVAL '1 hour' FROM generate_series(1, 1101)`, [benignProcess])
    await query('DELETE FROM log_processing_cursors WHERE name = \'process_logs_recovery\'')
    for (const statement of logProcessQueueSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    const snapshot = (await query('SELECT recent_id FROM log_processing_cursors WHERE name = \'process_logs_recovery\'')).rows[0].recent_id
    await query(`INSERT INTO service_logs (service, host, level, message, metadata)
        SELECT 'audit', 'busy-host', 'info', 'true', $1 FROM generate_series(1, 1101)`, [benignProcess])
    const delayedCommand = (await query(`INSERT INTO service_logs (service, host, level, message, metadata, created_at)
        VALUES ('audit', 'delayed-vm', 'info', 'whoami', $1, NOW() - INTERVAL '1 day') RETURNING id::text`, [commandMetadata])).rows[0].id
    const structuredCommand = (await query(`INSERT INTO service_logs (service, host, level, message, metadata)
        VALUES ('application', 'structured-host', 'info', 'whoami', $1) RETURNING id::text`, [{ structured: commandMetadata }])).rows[0].id
    const malformed = (await query(`INSERT INTO service_logs (service, host, level, message, metadata)
        VALUES ('application', 'untyped-host', 'info', 'plain', '{"process":[]}') RETURNING id::text`)).rows[0].id
    assert.equal((await query('SELECT 1 FROM log_process_queue WHERE log_id=$1', [malformed])).rowCount, 0)
    await query('SAVEPOINT rejected_insertion')
    const rolledBack = (await query(insertCommand, [commandMetadata])).rows[0].id
    await query('ROLLBACK TO SAVEPOINT rejected_insertion')
    assert.equal((await query('SELECT 1 FROM log_process_queue WHERE log_id=$1', [rolledBack])).rowCount, 0, 'Admission rolls back with its source insertion')
    const pendingBefore = await readPendingProcessLogs()
    assert.equal(pendingBefore.count, 1103)
    await query('SAVEPOINT queue_limit_fixture')
    await query('DELETE FROM log_process_queue')
    const cappedRows = (await query(`INSERT INTO service_logs(service,host,level,message,metadata,created_at)
        SELECT 'audit','cap-fixture','info','true',$1,NOW()-INTERVAL '1 day' FROM generate_series(1,20) RETURNING *`, [benignProcess])).rows
    const cappedPages: number[] = []
    await processQueuedLogs(async logs => { cappedPages.push(logs.length); await processLogBatch(logs, 'fixture', rules) }, true, 2)
    assert.deepEqual(cappedPages, [2,2,2,2])
    assert.equal((await readPendingProcessLogs()).count, 12)
    await processLogBatch([cappedRows[19]], 'fixture', rules)
    await acknowledgeProcessedLogs([String(cappedRows[18].id), String(cappedRows[19].id)])
    assert.equal((await readPendingProcessLogs()).count, 11, 'Live ACK removes only the completed event while the older pending event remains queued')
    assert.equal((await query('SELECT count(*)::int AS count FROM log_process_queue WHERE log_id=$1', [cappedRows[18].id])).rows[0].count, 1)
    await query('ROLLBACK TO SAVEPOINT queue_limit_fixture')
    const startedQueue = performance.now()
    let queuePages = 0
    await processQueuedLogs(async logs => {
        await processLogBatch(logs, 'fixture', rules)
        queuePages++
        await query(`INSERT INTO service_logs (service, host, level, message, metadata)
            SELECT 'audit', 'busy-host', 'info', 'true', $1 FROM generate_series(1, 1000)`, [benignProcess])
    })
    assert.equal(queuePages, 2)
    for (const id of [delayedCommand, structuredCommand]) {
        const row = (await query('SELECT normalized, processing_status FROM events WHERE log_key=$1', [`service:${id}`])).rows[0]
        assert.equal(row?.processing_status, 'processed')
        assert.equal(row.normalized.severity, 'high')
        assert.equal(row.normalized.rules_checked, rules.filter(rule => rule.enabled !== false).length)
    }
    assert.equal((await readPendingProcessLogs()).count, 2000, 'Later arrivals remain queued without displacing older admitted work')
    await recoverProcessLogs(logs => processLogBatch(logs, 'fixture', rules))
    assert.equal((await query('SELECT 1 FROM events WHERE log_key=$1', [`service:${oldCommand}`])).rowCount, 0, 'Recovery page stays bounded')
    assert.ok(BigInt((await query('SELECT recent_id FROM log_processing_cursors WHERE name=\'process_logs_recovery\'')).rows[0].recent_id) < BigInt(snapshot))
    const durableRecoveryId = (await query('SELECT recent_id FROM log_processing_cursors WHERE name=\'process_logs_recovery\'')).rows[0].recent_id
    for (const statement of logProcessQueueSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
    assert.equal((await query('SELECT recent_id FROM log_processing_cursors WHERE name=\'process_logs_recovery\'')).rows[0].recent_id, durableRecoveryId, 'Restart/redeploy preserves recovery progress')
    await recoverProcessLogs(logs => processLogBatch(logs, 'fixture', rules))
    const recoveredCommand = (await query('SELECT normalized, processing_status FROM events WHERE log_key=$1', [`service:${oldCommand}`])).rows[0]
    assert.equal(recoveredCommand?.processing_status, 'processed', 'Aged pre-upgrade command recovers automatically despite newer arrivals')
    assert.equal(recoveredCommand.normalized.severity, 'high')
    assert.equal(recoveredCommand.normalized.rules_checked, rules.filter(rule => rule.enabled !== false).length)
    const finalFindingCount = (await query('SELECT COUNT(*)::int AS count FROM findings')).rows[0].count
    await recoverProcessLogs(logs => processLogBatch(logs, 'fixture', rules))
    assert.equal((await query('SELECT COUNT(*)::int AS count FROM findings')).rows[0].count, finalFindingCount)
    await query('INSERT INTO organizations (id, status, name) VALUES (\'archived-priority\', \'active\', \'Archived fixture\')')
    const retryMetadata = { ...commandMetadata, organizationId: 'archived-priority', user: { id: 'private-user', email: 'private@example.test' } }
    const archivedLog = (await query(`INSERT INTO service_logs (service, host, level, message, metadata)
        VALUES ('audit', 'archived-host', 'info', 'whoami', $1) RETURNING *`, [retryMetadata])).rows[0]
    context.queryObserver = async sql => { if (sql.startsWith('SELECT rule_id, severity')) throw new Error('Fixture interrupted before completion') }
    await assert.rejects(processLogBatch([archivedLog], 'archived-priority', rules), /Fixture interrupted/)
    context.queryObserver = undefined
    await query('UPDATE organizations SET status=\'inactive\' WHERE id=\'archived-priority\'')
    await processStoredLogs()
    const reassignedRetry = (await query('SELECT * FROM events WHERE log_key=$1', [`service:${archivedLog.id}`])).rows[0]
    assert.equal(reassignedRetry.processing_status, 'processed')
    assert.equal(reassignedRetry.organization_id, 'fixture')
    assert.equal(reassignedRetry.user_id, 'private-user')
    assert.equal(reassignedRetry.user_email, 'private@example.test')
    assert.equal(reassignedRetry.original.service_log_id, String(archivedLog.id))
    assert.ok(JSON.stringify(reassignedRetry.normalized).includes('private-user'))
    assert.equal((await query('SELECT 1 FROM log_process_queue WHERE log_id=$1', [archivedLog.id])).rowCount, 0,
        'An organization becoming inactive during retry cannot poison the command FIFO')
    console.log(`Process queue PostgreSQL verification passed: transactional admission, delayed VM detection, FIFO under sustained arrivals, bounded recovery, deduplication; 1,103 queued events processed in ${Math.round(performance.now()-startedQueue)} ms including recovery checks.`)
    return { insertCommand, benignProcess }
}
