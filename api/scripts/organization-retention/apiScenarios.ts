import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import Fastify from 'fastify'
import ingestLog from '../../src/handlers/logs/ingest.ts'
import { postOrganizationPrivacy } from '../../src/handlers/organizationPrivacy.ts'
import { putOrganizationSettings } from '../../src/handlers/organizations.ts'
import { queryOnce } from '../../src/utils/db.ts'
import {
    queueOrganizationRetentionRun,
    runOrganizationRetentionWorker,
} from '../../src/utils/organizationPrivacy.ts'

export async function runRetentionApiScenarios({ users, tiModes, poisonRequestId, currentPassword }: {
    users: string[]
    tiModes: Map<string, 'missing' | 'record-failure'>
    poisonRequestId: string
    currentPassword: string
}) {
    const app = Fastify({ logger: false })
    app.post('/api/logs/ingest', ingestLog)
    app.post('/api/organizations/:id/privacy', postOrganizationPrivacy)
    app.put('/api/organizations/:id/settings', putOrganizationSettings)
    await app.ready()
    const deadLetterReplay = await app.inject({
        method: 'POST', url: '/api/organizations/retention_org_poison/privacy',
        headers: { authorization: 'Bearer retention-poison-token', id: users[5] },
        payload: { action: 'run_retention', requestId: poisonRequestId },
    })
    assert.equal(deadLetterReplay.statusCode, 502, deadLetterReplay.body)
    assert.match(deadLetterReplay.body, /failed after 5 attempts/i)

    tiModes.set('retention_org_locked', 'record-failure')
    const lockedRun = await queueOrganizationRetentionRun({ organizationId: 'retention_org_locked', triggerType: 'privacy_deletion', requestedBy: users[13], requestId: randomUUID(), retentionDays: 30 })
    assert.equal((await runOrganizationRetentionWorker(lockedRun.id)).failed, true)
    const durableLock = (await queryOnce('SELECT status, audit_safe_metadata FROM organizations WHERE id = \'retention_org_locked\'')).rows[0]
    assert.equal(durableLock.status, 'archived')
    assert.equal(durableLock.audit_safe_metadata.privacyDeletionRunId, lockedRun.id)
    const lockedMutation = await app.inject({
        method: 'PUT', url: '/api/organizations/retention_org_locked/settings',
        headers: { authorization: 'Bearer retention-locked-token', id: users[13] },
        payload: { retentionDays: 60 },
    })
    assert.equal(lockedMutation.statusCode, 409, lockedMutation.body)
    assert.match(lockedMutation.body, /deletion is in progress/i)
    tiModes.delete('retention_org_locked')
    await queryOnce('UPDATE organization_retention_runs SET next_retry_at = NOW() WHERE id = $1', [lockedRun.id])
    assert.equal((await runOrganizationRetentionWorker(lockedRun.id)).failed, false)

    const adminDeletion = await app.inject({
        method: 'POST', url: '/api/organizations/retention_org_auth/privacy',
        headers: { authorization: 'Bearer retention-admin-token', id: users[10] },
        payload: { action: 'delete', requestId: 'admin-delete', confirmation: 'Authenticated Deletion', currentPassword },
    })
    assert.equal(adminDeletion.statusCode, 403, adminDeletion.body)
    const wrongConfirmation = await app.inject({
        method: 'POST', url: '/api/organizations/retention_org_auth/privacy',
        headers: { authorization: 'Bearer retention-owner-token', id: users[9] },
        payload: { action: 'delete', requestId: 'wrong-name', confirmation: 'client-controlled name', currentPassword },
    })
    assert.equal(wrongConfirmation.statusCode, 400, wrongConfirmation.body)
    const wrongPassword = await app.inject({
        method: 'POST', url: '/api/organizations/retention_org_auth/privacy',
        headers: { authorization: 'Bearer retention-owner-token', id: users[9] },
        payload: { action: 'delete', requestId: 'wrong-password', confirmation: 'Authenticated Deletion', currentPassword: 'wrong' },
    })
    assert.equal(wrongPassword.statusCode, 403, wrongPassword.body)
    const authenticatedDeletion = await app.inject({
        method: 'POST', url: '/api/organizations/retention_org_auth/privacy',
        headers: { authorization: 'Bearer retention-owner-token', id: users[9] },
        payload: { action: 'delete', requestId: 'authenticated-delete', confirmation: 'Authenticated Deletion', currentPassword },
    })
    assert.equal(authenticatedDeletion.statusCode, 200, authenticatedDeletion.body)
    assert.equal((await queryOnce('SELECT status FROM organizations WHERE id = \'retention_org_auth\'')).rows[0].status, 'deleted')
    assert.equal((await queryOnce('SELECT COUNT(*)::int count FROM organization_members WHERE organization_id = \'retention_org_auth\'')).rows[0].count, 0)

    return app
}
