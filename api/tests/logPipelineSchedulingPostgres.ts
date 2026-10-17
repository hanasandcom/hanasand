import assert from 'node:assert/strict'
import type { LogPipelinePostgresContext } from './logPipelinePostgresContext.ts'

type QueueFixtures = { insertCommand: string, benignProcess: Record<string, unknown> }

export async function runLogPipelineSchedulingChecks(context: LogPipelinePostgresContext, queueFixtures: QueueFixtures) {
    const { query, client, processStoredLogs, loadConfiguredRules, logProcessQueueSchema } = context
    const { insertCommand, benignProcess } = queueFixtures
    // Exercise the real oldest-receipt query, all four forward/history limits and
    // durable cursors without changing the surrounding fixture's source state.
    await query('SAVEPOINT historical_throttle')
    await query('TRUNCATE service_logs CASCADE')
    await query('TRUNCATE login_events, traffic_events, system_events')
    await query('UPDATE log_processing_cursors SET recent_id=0 WHERE name=\'process_logs_recovery\'')
    const throttleSources = [
        ['service_logs', 'service,host,level,message,created_at', '\'throttle\',\'fixture-host\',\'info\',\'ordinary history\''],
        ['login_events', 'user_id,ip,status,created_at', '\'throttle-user-\'||n,\'192.0.2.201\',\'success\''],
        ['traffic_events', 'domain,path,method,status,created_at', '\'fixture.test\',\'/throttle\',\'GET\',200'],
        ['system_events', 'event_type,severity,organization_id,created_at', '\'fixture.throttle\',\'info\',\'fixture\''],
    ]
    const histories: Array<{ source: string, ids: string[] }> = []
    for (const [source, columns, values] of throttleSources) {
        const inserted = await query(`INSERT INTO ${source} (${columns}) SELECT ${values},
            CASE WHEN n=501 THEN clock_timestamp() ELSE clock_timestamp()-INTERVAL '1 hour' END
            FROM generate_series(1,501) n RETURNING id::text`)
        const ids = inserted.rows.map(row => row.id as string).sort((a,b) => BigInt(a) < BigInt(b) ? -1 : 1)
        histories.push({ source, ids })
        await query(`INSERT INTO log_processing_cursors(name,last_id,recent_id) VALUES($1,$2,$3)
            ON CONFLICT(name) DO UPDATE SET last_id=EXCLUDED.last_id,recent_id=EXCLUDED.recent_id,history_end_id=NULL`,
        [source, String(BigInt(ids[0])-1n), ids[249]])
    }
    const previousCatchupLimit = process.env.LOG_CATCHUP_BATCH_LIMIT
    let delayedReceipt = ''
    context.queryObserver = async sql => {
        if (sql.includes('AS delayed') && !delayedReceipt) {
            // The indexed age snapshot chooses this tick's allocation before the queue drains.
            delayedReceipt = (await client.query(insertCommand, [benignProcess])).rows[0].id
            await client.query('UPDATE log_process_queue SET queued_at=clock_timestamp()-INTERVAL \'61 seconds\' WHERE log_id=$1', [delayedReceipt])
        }
    }
    try {
        await processStoredLogs()
        context.queryObserver = undefined
        for (const { source, ids } of histories) {
            const state = (await query('SELECT last_id::text,recent_id::text FROM log_processing_cursors WHERE name=$1', [source])).rows[0]
            assert.equal(state.last_id, ids[99], `${source} history advances by exactly100 acknowledged rows`)
            assert.equal(state.recent_id, ids[349], `${source} forward cursor advances exactly100 rows without jumping the remaining151`)
            const keys = ids.map(id => `service:${source==='service_logs'?'':source+':'}${id}`)
            assert.equal((await query('SELECT COUNT(*)::int AS count FROM events WHERE log_key=ANY($1::text[]) AND processing_status=\'processed\'', [keys])).rows[0].count,source === 'service_logs' ? 201 : 200,
                `${source} has100 historical rows and100 forward rows; service event-time priority also checks the newest row`)
        }
        assert.equal((await query('SELECT COUNT(*)::int AS count FROM log_process_queue WHERE log_id=$1', [delayedReceipt])).rows[0].count,0, 'The aged command is acknowledged without changing the fixed allocation for this tick')
        // An operator cap remains effective even after the command queue clears.
        // Add an upgrade-recovery stream without trigger admission, then verify
        // its actual SQL page/cursor independently of forward-source overlap.
        await query('DROP TRIGGER log_process_queue_insert ON service_logs')
        const recoveryRows = await query(`INSERT INTO service_logs (service,host,level,message,metadata,created_at)
            SELECT 'audit','limited-recovery','info','true',$1,NOW()-INTERVAL '1 day'
            FROM generate_series(1,251) RETURNING id::text`, [benignProcess])
        const recoveryIds = recoveryRows.rows.map(row => row.id as string).sort((a,b) => BigInt(a)<BigInt(b)?-1:1)
        for (const statement of logProcessQueueSchema) await query(statement.replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMP TABLE IF NOT EXISTS'))
        await query('UPDATE log_processing_cursors SET recent_id=$1 WHERE name=\'process_logs_recovery\'', [recoveryIds.at(-1)])
        process.env.LOG_CATCHUP_BATCH_LIMIT = '100'
        await processStoredLogs()
        for (const { source, ids } of histories) {
            const state = (await query('SELECT last_id::text,recent_id::text FROM log_processing_cursors WHERE name=$1', [source])).rows[0]
            assert.equal(state.last_id, ids[199], `${source} history stays capped while the command queue is clear`)
            assert.equal(state.recent_id, ids[449], `${source} forward work stays capped while the command queue is clear`)
        }
        const recoveryKeys = recoveryIds.map(id => `service:${id}`)
        assert.equal((await query('SELECT COUNT(*)::int AS count FROM events WHERE log_key=ANY($1::text[]) AND processing_status=\'processed\'', [recoveryKeys])).rows[0].count,100)
        assert.equal((await query('SELECT recent_id::text FROM log_processing_cursors WHERE name=\'process_logs_recovery\'')).rows[0].recent_id,recoveryIds[150],
            'The recovery cap preserves the first unprocessed ID for the next page')
        delete process.env.LOG_CATCHUP_BATCH_LIMIT
        await processStoredLogs() // Clearing the operator control restores full capacity.
        const recovered = await query('SELECT normalized FROM events WHERE log_key=ANY($1::text[]) AND processing_status=\'processed\'', [recoveryKeys])
        assert.equal(recovered.rowCount,251, 'Recovery resumes without losing any capped remainder')
        const enabledRules = (await loadConfiguredRules('fixture')).filter(rule => rule.enabled !== false).length
        assert.ok(enabledRules > 0)
        assert.ok(recovered.rows.every(row => row.normalized.rules_checked === enabledRules))
        for (const { source, ids } of histories) {
            const state = (await query('SELECT last_id::text,recent_id::text FROM log_processing_cursors WHERE name=$1', [source])).rows[0]
            assert.equal(state.last_id, ids[249], `${source} finishes its fixed historical range without rechecking forward rows`)
            assert.ok(BigInt(state.recent_id) >= BigInt(ids[500]), `${source} resumes full forward capacity`)
            const keys = ids.map(id => `service:${source==='service_logs'?'':source+':'}${id}`)
            assert.equal((await query('SELECT COUNT(*)::int AS count FROM events WHERE log_key=ANY($1::text[]) AND processing_status=\'processed\'', [keys])).rows[0].count,501, `${source} retains complete coverage through cursor overlap`)
        }
    } finally {
        queryObserver=undefined
        if (previousCatchupLimit === undefined) delete process.env.LOG_CATCHUP_BATCH_LIMIT
        else process.env.LOG_CATCHUP_BATCH_LIMIT = previousCatchupLimit
        await query('ROLLBACK TO SAVEPOINT historical_throttle')
    }
    console.log('PostgreSQL adaptive scheduling passed: indexed aged queue, four100-row forward/history pages, newest-event priority retained, operator recovery100 cap with exact cursors, complete coverage and defaults restored.')
}
