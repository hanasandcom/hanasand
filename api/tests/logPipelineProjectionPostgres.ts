import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import type { LogPipelinePostgresContext } from './logPipelinePostgresContext.ts'

export async function runLogPipelineProjectionChecks(context: LogPipelinePostgresContext) {
    const { query, processLogBatch, rules, backfillLogDimensions, dimensionLogWhere, foldLogCounts, compileLogQuery } = context
    assert.equal((await query('SELECT ready FROM log_dimensions_state')).rows[0].ready, true)
    async function assertProjectionParity() {
        const differences = await query(`WITH source AS (
            SELECT id AS event_id, organization_id, event_timestamp, normalized->>'severity' AS severity,
                normalized->>'service' AS service, normalized->>'log_type' AS log_type
            FROM events WHERE ingestion_id='logs' AND processing_status='processed')
            (SELECT * FROM source EXCEPT SELECT * FROM log_dimensions)
            UNION ALL (SELECT * FROM log_dimensions EXCEPT SELECT * FROM source)`)
        assert.equal(differences.rowCount, 0, 'Compact projection must match every currently processed collected event')
    }
    await assertProjectionParity() // Includes late-auth severity changes, replay and all configured detections.
    await query('UPDATE log_dimensions_state SET ready=FALSE,last_event_id=\'\'')
    assert.deepEqual(await backfillLogDimensions(1), { processed: 1, ready: false })
    assert.equal((await query('SELECT ready FROM log_dimensions_state')).rows[0].ready, false, 'Partial backfill is never reported as ready')
    while (!(await backfillLogDimensions(1000)).ready) { /* bounded resumable initialization */ }
    await assertProjectionParity()
    const inserted = `INSERT INTO events (id, ingestion_id, organization_id, event_timestamp, normalized)
        VALUES ('!after-cursor', 'logs', 'other', NOW(), '{"severity":"low","service":"temporary","log_type":"ApplicationLogs"}')`
    await query(inserted)
    await assertProjectionParity() // New IDs below the completed cursor are maintained by the trigger.
    await query(`UPDATE events SET normalized=normalized || '{"severity":"critical","service":null}',
        organization_id='fixture',event_timestamp=NOW()-INTERVAL '2 hours' WHERE id='!after-cursor'`)
    await assertProjectionParity()
    await query('UPDATE events SET processing_status=\'pending\' WHERE id=\'!after-cursor\'')
    await assertProjectionParity()
    await query('UPDATE events SET processing_status=\'processed\',ingestion_id=\'native\' WHERE id=\'!after-cursor\'')
    await assertProjectionParity()
    await query('UPDATE events SET ingestion_id=\'logs\',id=\'!renamed\' WHERE id=\'!after-cursor\'')
    await assertProjectionParity()
    await query('SAVEPOINT projection_retry')
    await query('UPDATE events SET normalized=\'{}\'::jsonb WHERE id=\'!renamed\'')
    await assertProjectionParity()
    await query('ROLLBACK TO SAVEPOINT projection_retry')
    await assertProjectionParity()
    await query('WITH removed AS (DELETE FROM events WHERE id=\'!renamed\' RETURNING id) SELECT * FROM removed')
    await assertProjectionParity()
    await query('INSERT INTO organizations (id,status,name) VALUES (\'projection-delete\',\'active\',\'Fixture\')')
    await query(`INSERT INTO events (id,ingestion_id,organization_id,event_timestamp,normalized)
        VALUES ('!delete-org','logs','projection-delete',NOW(),'{"severity":"critical","service":"private"}')`)
    await query('UPDATE organizations SET status=\'archived\' WHERE id=\'projection-delete\'')
    for (const kql of ['Logs', 'ApplicationLogs | where Severity != "critical"', 'Logs | where Service == "private"', 'Logs | where TimeGenerated > ago(1h)']) {
        const compiled = compileLogQuery(kql)
        const predicates = ['ingestion_id = \'logs\'', 'processing_status = \'processed\'', 'event_timestamp >= NOW()-INTERVAL \'24 hours\'',
            ...compiled.where, 'EXISTS (SELECT 1 FROM organizations o WHERE o.id=events.organization_id AND o.status=\'active\')']
        const original = await query(`SELECT normalized->>'severity' AS severity, normalized->>'service' AS service, COUNT(*)::int AS count
            FROM events WHERE ${predicates.join(' AND ')} GROUP BY 1,2 ORDER BY 1,2`, compiled.params)
        const compact = await query(`SELECT severity,service,COUNT(*)::int AS count FROM log_dimensions events
            WHERE ${dimensionLogWhere(predicates)!.join(' AND ')} GROUP BY 1,2 ORDER BY 1,2`, compiled.params)
        assert.deepEqual(compact.rows, original.rows, `Exact projected counters, including active organizations: ${kql}`)
        assert.deepEqual(foldLogCounts(compact.rows), foldLogCounts(original.rows))
    }
    await query('DELETE FROM organizations WHERE id=\'projection-delete\'')
    await assertProjectionParity()
    await query('SAVEPOINT projection_truncate')
    await query('TRUNCATE events CASCADE')
    assert.equal((await query('SELECT COUNT(*)::int AS count FROM log_dimensions')).rows[0].count, 0)
    await query('ROLLBACK TO SAVEPOINT projection_truncate')
    await assertProjectionParity()
    console.log('PostgreSQL projection verification passed: exact counter parity, bounded readiness, trigger updates, rollback, late correlation and cascading deletion.')
    const started = performance.now()
    await processLogBatch(Array.from({ length: 5000 }, (_, index) => ({ id: `volume-${index}`, service: 'fixture', host: 'fixture', level: 'info', message: 'Ordinary service log', created_at: new Date().toISOString() })), 'fixture', rules)
    console.log(`Ordinary-event throughput: ${Math.round(5000000 / (performance.now() - started))} events/second`)
    const deliverySource = readFileSync(new URL('../src/utils/caseDelivery.ts', import.meta.url), 'utf8')
    const claimSql = deliverySource.match(/await run\(`(UPDATE findings[\s\S]*?RETURNING \*)`\)/)?.[1]
    assert.ok(claimSql, 'Actual case-delivery claim SQL must be found')
    const claimed = await query(claimSql)
    assert.ok(claimed.rowCount, 'Ordinary organization findings remain eligible for shared cases')
    assert.ok(claimed.rows.every(row => row.evidence.restrictedLog === false), 'Restricted collected-log evidence must never be claimed for shared cases')
    const other = await query('SELECT count(*)::int AS count FROM findings WHERE organization_id = \'other\'')
    assert.equal(other.rows[0].count, 0, 'No findings in another organization')
}
