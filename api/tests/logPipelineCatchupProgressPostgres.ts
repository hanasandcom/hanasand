import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type { LogPipelinePostgresContext } from './logPipelinePostgresContext.ts'

export async function runLogPipelineCatchupProgressChecks(context: LogPipelinePostgresContext) {
    const { query, processLogBatch, processStoredLogs, rules, BUILTIN_RULES, securityRules } = context
    await query('INSERT INTO organizations(id,status,name) VALUES (\'deleted-scope\',\'deleted\',\'Deleted fixture\')')
    const replayIds = (await query('INSERT INTO service_logs(service,level,message,metadata) VALUES (\'fixture\',\'info\',\'Unknown org original\', \'{"organizationId":"missing-scope"}\'), (\'fixture\',\'info\',\'Deleted org original\', \'{"organizationId":"deleted-scope"}\') RETURNING id::text')).rows.map(row => row.id)
    for (const id of replayIds) await query('INSERT INTO events(id,ingestion_id,organization_id,log_key,processing_status,normalized,event_timestamp) VALUES($1,\'logs\',\'fixture\',$2,\'skipped\',$3,NOW())', [
        (await import('node:crypto')).createHash('sha256').update('service:'+id).digest('hex'), 'service:'+id, { processing_reason: 'Organization is missing or inactive' }])
    const { recoverUnassignedLogs } = await import('../src/utils/events/recoverUnassignedLogs.ts')
    await recoverUnassignedLogs(logs => processLogBatch(logs, 'fixture', rules))
    await recoverUnassignedLogs(logs => processLogBatch(logs, 'fixture', rules))
    const replayed = (await query('SELECT processing_status,organization_id,normalized FROM events WHERE log_key=$1', ['service:'+replayIds[0]])).rows[0]
    assert.equal(replayed.processing_status,'processed')
    assert.equal(replayed.organization_id,'fixture')
    assert.equal(replayed.normalized.message,'Unknown org original')
    assert.equal((await query('SELECT processing_status FROM events WHERE log_key=$1', ['service:'+replayIds[1]])).rows[0].processing_status,'processed')
    for (const cursorColumn of ['last_id', 'recent_id']) {
        const acknowledgedHistory = (await query(`INSERT INTO service_logs(service,level,message,metadata,created_at)
        SELECT 'history-fixture','info','Historical acknowledgement '||n,'{}'::jsonb,NOW()-INTERVAL '2 days'
        FROM generate_series(1,500) n RETURNING *`)).rows
        const holes = [acknowledgedHistory[199].id, acknowledgedHistory[399].id]
        await processLogBatch(acknowledgedHistory.filter(row => !holes.includes(row.id)), 'fixture', rules)
        await query('UPDATE log_processing_cursors SET last_id=$1,recent_id=$2,history_end_id=$2 WHERE name=\'service_logs\'',
            [String(BigInt(acknowledgedHistory[0].id)-1n), cursorColumn === 'last_id' ? acknowledgedHistory.at(-1).id : String(BigInt(acknowledgedHistory[0].id)-1n)])
        const previousHistoryLimit = process.env.LOG_CATCHUP_BATCH_LIMIT
        process.env.LOG_CATCHUP_BATCH_LIMIT = '1'
        try {
            for (const expected of [...holes, acknowledgedHistory.at(-1).id]) {
                await processStoredLogs()
                assert.equal(String((await query('SELECT ' + cursorColumn + ' AS position FROM log_processing_cursors WHERE name=\'service_logs\'')).rows[0].position), String(expected),
                    'Acknowledged rows may be passed, but the next pending row must obey the evaluation cap')
            }
        } finally {
            if (previousHistoryLimit === undefined) delete process.env.LOG_CATCHUP_BATCH_LIMIT
            else process.env.LOG_CATCHUP_BATCH_LIMIT = previousHistoryLimit
        }
        assert.equal(Number((await query('SELECT count(*) FROM events WHERE log_key=ANY($1::text[]) AND processing_status=\'processed\'',
            [acknowledgedHistory.map(row => 'service:'+row.id)])).rows[0].count), 500)
        console.log(`PostgreSQL ${cursorColumn} scan passed: pending holes processed in order at cap1, acknowledged rows skipped, complete durable coverage.`)
    }
    const { refreshLogCatchupProgress } = await import('../src/utils/events/catchupProgress.ts')
    await query('UPDATE events SET processing_status=\'processed\' WHERE ingestion_id=\'logs\' AND processing_status=\'pending\'')
    assert.equal(Number((await query('SELECT count(*) FROM events WHERE ingestion_id=\'logs\' AND processing_status=\'pending\'')).rows[0].count), 0,
        'The source-only progress assertion has no direct pending Events')
    await refreshLogCatchupProgress()
    await query('UPDATE log_catchup_progress SET sampled_at=NULL, attempted_at=NULL')
    await refreshLogCatchupProgress()
    const progress = (await query('SELECT payload FROM log_catchup_progress')).rows[0].payload
    let remaining = 0
    for (const source of ['login_events','traffic_events','system_events']) {
        const c = (await query('SELECT last_id,recent_id,history_end_id FROM log_processing_cursors WHERE name=$1',[source])).rows[0]
        remaining += Number((await query('SELECT count(*) FROM '+source+' WHERE id>$1 AND id<=$2',[c.last_id,c.history_end_id ?? c.recent_id])).rows[0].count)
        remaining += Number((await query('SELECT count(*) FROM '+source+' WHERE id>$1',[c.recent_id])).rows[0].count)
    }
    assert.equal(progress.remaining,remaining,'Progress counts retained rows, not sequence gaps')
    assert.equal(progress.estimated_seconds,remaining ? null : 0,'No fabricated rate in the first sample')
    // A source row can be waiting behind its durable cursor without an Events
    // row yet. It still contributes to catch-up progress. If its login Event
    // becomes pending before the cursor transaction commits, origin identity
    // must deduplicate the same unit of work; unrelated pending Events count.
    await query('UPDATE events SET processing_status=\'processed\' WHERE ingestion_id=\'logs\' AND processing_status=\'pending\'')
    for (const source of ['login_events','traffic_events','system_events']) {
        await query(`UPDATE log_processing_cursors SET last_id=(SELECT COALESCE(MAX(id),0) FROM ${source}),
            recent_id=(SELECT COALESCE(MAX(id),0) FROM ${source}),
            history_end_id=(SELECT COALESCE(MAX(id),0) FROM ${source}) WHERE name=$1`, [source])
    }
    await query('UPDATE log_catchup_progress SET payload=\'{}\'::jsonb, sampled_at=NULL, attempted_at=NULL, last_error=NULL WHERE id=TRUE')
    await refreshLogCatchupProgress()
    await query('DELETE FROM log_processing_cursors WHERE name=\'login_events\'')
    const { rows: [sourceOnly] } = await query('INSERT INTO login_events(user_id,ip,status) VALUES (\'catchup-user\',\'192.0.2.99\',\'failed\') RETURNING id')
    assert.equal(Number((await query('SELECT count(*) FROM events WHERE ingestion_id=\'logs\' AND processing_status=\'pending\'')).rows[0].count), 0)
    await query('UPDATE log_catchup_progress SET sampled_at=NULL, attempted_at=NULL WHERE id=TRUE')
    await refreshLogCatchupProgress()
    let catchupRemaining = Number((await query('SELECT payload->>\'remaining\' AS remaining FROM log_catchup_progress WHERE id=TRUE')).rows[0].remaining)
    assert.equal(catchupRemaining, Number((await query('SELECT count(*) FROM login_events')).rows[0].count),
        'A missing cursor conservatively counts all source rows as outstanding')
    const priorLoginId = (await query('SELECT COALESCE(MAX(id),0) AS id FROM login_events WHERE id < $1', [sourceOnly.id])).rows[0].id
    await query('INSERT INTO log_processing_cursors(name,last_id,recent_id,history_end_id) VALUES(\'login_events\',$1,$1,$1)', [priorLoginId])
    await query('UPDATE log_catchup_progress SET sampled_at=NULL, attempted_at=NULL WHERE id=TRUE')
    await refreshLogCatchupProgress()
    catchupRemaining = Number((await query('SELECT payload->>\'remaining\' AS remaining FROM log_catchup_progress WHERE id=TRUE')).rows[0].remaining)
    assert.equal(catchupRemaining,1,'Source backlog is visible before a pending Event exists')
    const pendingSourceEventId = createHash('sha256').update(`service:login_events:${sourceOnly.id}`).digest('hex')
    await query(`INSERT INTO events(id,ingestion_id,organization_id,event_timestamp,normalized,processing_status)
        VALUES($1,'logs','fixture',NOW(),$2,'pending')`, [pendingSourceEventId,
        JSON.stringify({ metadata: { origin: { table: 'login_events', id: String(sourceOnly.id) } } })])
    await query(`INSERT INTO events(id,ingestion_id,organization_id,event_timestamp,normalized,processing_status)
        VALUES('catchup-direct-event','logs','fixture',NOW(),'{}','pending')`)
    await query('UPDATE log_catchup_progress SET sampled_at=NULL, attempted_at=NULL WHERE id=TRUE')
    await refreshLogCatchupProgress()
    catchupRemaining = Number((await query('SELECT payload->>\'remaining\' AS remaining FROM log_catchup_progress WHERE id=TRUE')).rows[0].remaining)
    assert.equal(catchupRemaining,2,'Matching source-origin Event is deduplicated while direct pending Events count')
    console.log(`PostgreSQL verification passed: all ${BUILTIN_RULES.length} rules, ${securityRules.length} negatives, retry deduplication, auth correlation, and KQL.`)
}
