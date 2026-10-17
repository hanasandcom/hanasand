import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { queryOnce } from '../../src/utils/db.ts'
import {
    exportOrganizationPrivacyData,
    queueOrganizationRetentionRun,
    runOrganizationRetentionWorker,
    organizationPrivacyState,
} from '../../src/utils/organizationPrivacy.ts'

export async function runRetentionWorkerScenarios({ users, old, tiModes, tiPages }: {
    users: string[]
    old: string
    tiModes: Map<string, 'missing' | 'record-failure'>
    tiPages: Map<string, number>
}) {
    const runARequestId = randomUUID()
    const runA = await queueOrganizationRetentionRun({ organizationId: 'retention_org_a', triggerType: 'manual', requestedBy: users[0], requestId: runARequestId, retentionDays: 30 })
    const duplicateRunA = await queueOrganizationRetentionRun({ organizationId: 'retention_org_a', triggerType: 'manual', requestedBy: users[0], requestId: runARequestId, retentionDays: 30 })
    assert.equal(duplicateRunA.id, runA.id, 'replaying a request must return the existing retention run')
    assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_retention_runs WHERE organization_id = $1 AND request_id = $2', ['retention_org_a', runARequestId])).rows[0].count, 1)
    assert.deepEqual(await runOrganizationRetentionWorker(runA.id), { claimed: true, runId: runA.id, failed: false, hasMore: false, deadLetter: false })
    assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_invites WHERE id = \'invite_delete\'')).rows[0].count, 0)
    assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_invites WHERE id = \'invite_hold\'')).rows[0].count, 1)
    assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_watchlist_items WHERE id = \'watch_delete\'')).rows[0].count, 0)
    assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_watchlist_items WHERE id = \'watch_hold\'')).rows[0].count, 1)
    assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_members WHERE organization_id = \'retention_org_a\' AND user_id = $1', [users[3]])).rows[0].count, 0)
    assert.deepEqual((await queryOnce('SELECT payload FROM dwm_webhook_deliveries WHERE id = \'delivery_delete\'')).rows[0].payload, {})
    assert.deepEqual((await queryOnce('SELECT payload FROM dwm_webhook_deliveries WHERE id = \'delivery_hold\'')).rows[0].payload, { secret: 'hold' })
    assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_invites WHERE id = \'invite_other\'')).rows[0].count, 1)
    assert.deepEqual((await queryOnce('SELECT payload FROM dwm_webhook_deliveries WHERE id = \'delivery_other\'')).rows[0].payload, { secret: 'other' })
    assert.equal((await runOrganizationRetentionWorker(runA.id)).claimed, false)

    const exported = await exportOrganizationPrivacyData('retention_org_a')
    assert.equal((exported.data.public.organization as { id: string }).id, 'retention_org_a')
    assert.equal((exported.data.threatIntelligence as { organizationId: string }).organizationId, 'retention_org_a')
    assert.deepEqual(Object.keys(exported.data.public).sort(), [
        'access_recovery_evidence', 'admin_audit_events', 'invites', 'members', 'organization',
        'events', 'privacy_requests', 'retention_items', 'retention_runs', 'watchlists',
        'webhook_audit_events', 'webhook_deliveries', 'webhook_destinations',
    ])

    const interrupted = await queueOrganizationRetentionRun({ organizationId: 'retention_org_b', triggerType: 'manual', requestedBy: users[1], requestId: randomUUID(), retentionDays: 30 })
    await queryOnce('UPDATE organization_retention_runs SET status = \'running\', updated_at = NOW() - INTERVAL \'20 minutes\' WHERE id = $1', [interrupted.id])
    assert.equal((await runOrganizationRetentionWorker(interrupted.id)).failed, false)
    assert.equal((await queryOnce('SELECT attempt_count FROM organization_retention_runs WHERE id = $1', [interrupted.id])).rows[0].attempt_count, 1)

    tiModes.set('retention_org_c', 'record-failure')
    const retryRun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_c', triggerType: 'manual', requestedBy: users[2], requestId: randomUUID(), retentionDays: 30 })
    assert.equal((await runOrganizationRetentionWorker(retryRun.id)).failed, true)
    tiModes.delete('retention_org_c')
    await queryOnce('UPDATE organization_retention_runs SET next_retry_at = NOW() WHERE id = $1', [retryRun.id])
    assert.equal((await runOrganizationRetentionWorker(retryRun.id)).failed, false)
    assert.equal((await queryOnce('SELECT status FROM organization_retention_run_items WHERE run_id = $1 AND record_type = \'capture\' AND record_id = \'capture_retry\'', [retryRun.id])).rows[0].status, 'redacted')

    tiModes.set('retention_org_recovered', 'missing')
    const recoveredRun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_recovered', triggerType: 'manual', requestedBy: users[4], requestId: randomUUID(), retentionDays: 30 })
    assert.equal((await runOrganizationRetentionWorker(recoveredRun.id)).failed, true)
    const recoveredRetry = (await queryOnce('SELECT attempt_count, EXTRACT(EPOCH FROM (next_retry_at - NOW()))::int retry_delay FROM organization_retention_runs WHERE id = $1', [recoveredRun.id])).rows[0]
    assert.equal(recoveredRetry.attempt_count, 1)
    assert.equal(recoveredRetry.retry_delay >= 55 && recoveredRetry.retry_delay <= 60, true)
    tiModes.delete('retention_org_recovered')
    await queryOnce('UPDATE organization_retention_runs SET next_retry_at = NOW() WHERE id = $1', [recoveredRun.id])
    assert.equal((await runOrganizationRetentionWorker(recoveredRun.id)).failed, false)
    assert.equal((await queryOnce('SELECT status FROM organization_retention_run_items WHERE run_id = $1 AND record_type = \'service\'', [recoveredRun.id])).rows[0].status, 'retried')
    assert.equal((await queryOnce('SELECT protected_count FROM organization_retention_runs WHERE id = $1', [recoveredRun.id])).rows[0].protected_count, 0)

    const pageARun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_page_a', triggerType: 'manual', requestedBy: users[11], requestId: randomUUID(), retentionDays: 30 })
    const pageBRun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_page_b', triggerType: 'manual', requestedBy: users[12], requestId: randomUUID(), retentionDays: 30 })
    assert.equal((await runOrganizationRetentionWorker(pageARun.id)).hasMore, true)
    const yieldedTenant = await runOrganizationRetentionWorker()
    assert.equal(yieldedTenant.runId, pageBRun.id, 'a yielded multi-page tenant must not starve a later tenant')
    assert.equal(tiPages.get('retention_org_page_a'), 1)
    assert.equal((await runOrganizationRetentionWorker(pageARun.id)).hasMore, true)
    assert.equal((await runOrganizationRetentionWorker(pageARun.id)).hasMore, false)

    tiModes.set('retention_org_poison', 'missing')
    const poisonRequestId = randomUUID()
    const poisonRun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_poison', triggerType: 'manual', requestedBy: users[5], requestId: poisonRequestId, retentionDays: 30 })
    assert.equal((await runOrganizationRetentionWorker(poisonRun.id)).failed, true)
    const fairRun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_fair', triggerType: 'manual', requestedBy: users[6], requestId: randomUUID(), retentionDays: 30 })
    await queryOnce('UPDATE organization_retention_runs SET next_retry_at = NOW() WHERE id = $1', [poisonRun.id])
    const fairResult = await runOrganizationRetentionWorker()
    assert.equal(fairResult.runId, fairRun.id, 'an attempt-zero tenant must run before an older retrying tenant')
    for (let attempt = 2; attempt <= 5; attempt += 1) {
        await queryOnce('UPDATE organization_retention_runs SET next_retry_at = NOW() WHERE id = $1', [poisonRun.id])
        const result = await runOrganizationRetentionWorker(poisonRun.id)
        assert.equal(result.failed, true)
        const persisted = (await queryOnce('SELECT status, attempt_count, EXTRACT(EPOCH FROM (next_retry_at - NOW()))::int retry_delay FROM organization_retention_runs WHERE id = $1', [poisonRun.id])).rows[0]
        assert.equal(persisted.attempt_count, attempt)
        assert.equal(persisted.status, attempt === 5 ? 'dead_letter' : 'failed')
        if (attempt < 5) assert.equal(persisted.retry_delay >= 60 * 2 ** (attempt - 1) - 5, true)
    }
    assert.deepEqual(await runOrganizationRetentionWorker(poisonRun.id), { claimed: false })

    const concurrentResults = await Promise.allSettled([
        queueOrganizationRetentionRun({ organizationId: 'retention_org_concurrent', triggerType: 'manual', requestedBy: users[8], requestId: randomUUID(), retentionDays: 30 }),
        queueOrganizationRetentionRun({ organizationId: 'retention_org_concurrent', triggerType: 'privacy_deletion', requestedBy: users[8], requestId: randomUUID(), retentionDays: 30 }),
    ])
    assert.deepEqual(concurrentResults.map(result => result.status).sort(), ['fulfilled', 'rejected'])
    const concurrentRun = concurrentResults.find(result => result.status === 'fulfilled')
    assert.equal(Boolean(concurrentRun && await runOrganizationRetentionWorker(concurrentRun.value.id)), true)

    await queryOnce(`
    INSERT INTO organization_retention_runs (id, organization_id, trigger_type, status, retention_days, cutoff_at, completed_at)
    VALUES ('retention_page_run', 'retention_org_page', 'manual', 'completed', 30, $1, NOW())
`, [old])
    await queryOnce(`
    INSERT INTO organization_retention_run_items (run_id, organization_id, source_service, record_type, record_id, action, status, reason)
    SELECT 'retention_page_run', 'retention_org_page', 'ti-scraper', 'capture', 'protected-' || value, 'retain', 'protected', 'legal_hold'
      FROM generate_series(1, 105) value
`)
    const firstProtectedPage = await organizationPrivacyState('retention_org_page', { itemOffset: 0, itemLimit: 100 })
    const secondProtectedPage = await organizationPrivacyState('retention_org_page', { itemOffset: 100, itemLimit: 100 })
    assert.equal(firstProtectedPage.items.length, 100)
    assert.equal(firstProtectedPage.itemPage.nextOffset, 100)
    assert.equal(secondProtectedPage.items.length, 5)
    assert.equal(secondProtectedPage.itemPage.nextOffset, null)
    return { runA, poisonRequestId }
}
