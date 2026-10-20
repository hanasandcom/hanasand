import assert from 'node:assert/strict'
import { evaluateThreatIntelBackupStatus } from './backup-status.mjs'
import { evaluateDashboardText } from './dashboard-signals.mjs'
import { buildDiscordPayload, failureImpact, reasonLabel, resultFields } from './monitor-messages.mjs'

export function runSelfTest() {
    const healthy = evaluateDashboardText(`
        Operations
        Database
        Live
        Database metrics loaded from the live PostgreSQL telemetry views.
        Query watcher
        0 active
        No long-running queries right now
        Clusters
        1
        Databases
        2
        Storage
        108.00 MB
        Active queries
        0
        Long-running
        0
    `)
    assert.equal(healthy.ok, true)
    assert.equal(healthy.metrics.clusters, 1)
    assert.equal(healthy.metrics.databases, 2)
    assert.ok(healthy.metrics.storageBytes > 0)

    const abbreviated = evaluateDashboardText(`
        Operations
        Database
        Live
        Clusters
        1
        DBs
        2
        Storage
        108.00 MB
        Active queries
        0
        Long-running
        0
    `)
    assert.equal(abbreviated.ok, true)
    assert.equal(abbreviated.metrics.databases, 2)

    const unavailable = evaluateDashboardText(`
        Operations
        Database
        Unavailable
        Database metrics unavailable: the internal API cannot authenticate to PostgreSQL.
        Clusters
        Connecting
        Databases
        Connecting
        Storage
        Metering
    `)
    assert.equal(unavailable.ok, false)
    assert.equal(unavailable.reason, 'db_dashboard_unavailable')
    assertDiscordPayload(unavailable)

    const shell = evaluateDashboardText(`
        Operations
        Database
        Clusters
        0
        Databases
        0
        Storage
        0 B
        Active queries
        0
        Long-running
        0
    `)
    assert.equal(shell.ok, false)
    assert.equal(shell.reason, 'db_dashboard_missing_clusters')

    const previousUiCopy = evaluateDashboardText(`
        Operations
        Database
        Clusters
        1
        Databases
        2
        Storage
        108.00 MB
        Active queries
        0
        Longest running query
        No active query details available.
    `)
    assert.equal(previousUiCopy.ok, true)
    assertBackupResults()
    console.log('Database dashboard monitor self-test passed.')
}

function assertDiscordPayload(unavailable) {
    const discordPayload = buildDiscordPayload({
        status: 'DOWN',
        color: 0xef4444,
        title: `Database dashboard unavailable: ${reasonLabel(unavailable.reason)}`,
        description: `${failureImpact(unavailable.reason)} ${unavailable.detail}`,
        fields: resultFields({
            ...unavailable,
            latencyMs: 123,
            failureScreenshotUrl: 'https://cdn.hanasand.com/api/files/path/monitor%2Fdb-dashboard%2Fdb-dashboard-monitor-failure-20260708-120000000Z.png',
        }),
    })
    assert.match(discordPayload.content, /Database dashboard unavailable: unavailable/)
    assert.match(discordPayload.content, /unavailable or reconnecting telemetry state/)
    assert.match(discordPayload.content, /\nhttps:\/\/cdn\.hanasand\.com\/api\/files\/path\//)
    assert.doesNotMatch(discordPayload.content, /check failed/i)
    assert.ok(discordPayload.content.length < 340)
    assert.ok(discordPayload.embeds[0].fields.some(field => field.name === 'Action' && /API auth|PostgreSQL telemetry/.test(field.value)))
    assert.ok(discordPayload.embeds[0].fields.some(field => field.name === 'Evidence' && /https:\/\/cdn\.hanasand\.com\/api\/files\/path\//.test(field.value)))
    assert.ok(!discordPayload.embeds[0].fields.some(field => field.name === 'Screenshot'))
}

function assertBackupResults() {
    const checkedAt = new Date('2026-07-24T12:00:00.000Z')
    const healthy = evaluateThreatIntelBackupStatus(backupRecord('succeeded', 0, 'complete', '2026-07-24T11:00:00Z'), checkedAt)
    assert.equal(healthy.ok, true)
    const failed = evaluateThreatIntelBackupStatus(backupRecord('failed', 1, 'backup', '2026-07-24T11:00:00Z', 'command_failed'), checkedAt)
    assert.equal(failed.ok, false)
    assert.equal(failed.reason, 'ti_backup_failed')
    const stale = evaluateThreatIntelBackupStatus(backupRecord('succeeded', 0, 'complete', '2026-07-22T11:00:00Z'), checkedAt)
    assert.equal(stale.ok, false)
    assert.equal(stale.reason, 'ti_backup_stale')
}

function backupRecord(status, exitCode, phase, finishedAt, reason = 'none') {
    return `format=hanasand.threat_intel_backup_status.v2\nstatus=${status}\nexit_code=${exitCode}\nphase=${phase}\nreason=${reason}\nfinished_at=${finishedAt}\narchive=/home/hanasand/backups/threat-intel/archive`
}
