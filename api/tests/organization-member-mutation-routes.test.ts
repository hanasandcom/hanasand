import { beforeEach, expect, test } from 'bun:test'
import { app, resetOrganizationRolePermissionsFixture, state } from './fixtures/organization-role-permissions-harness.ts'

beforeEach(resetOrganizationRolePermissionsFixture)

test('member role receipt uses the watchlist handler policy for readers and editors', async () => {
    state.role = 'owner'
    const response = await app.inject({
        method: 'PATCH',
        url: '/org/org/members/teammate/role',
        payload: { role: 'editor', reason: 'Grant watchlist access.' },
    })

    expect(response.statusCode).toBe(200)
    const receipt = response.json().roleChange.consumerVisibilityReceipt
    expect(receipt.before).toEqual({
        role: 'reader',
        canReadSharedWatchlists: true,
        canExportAlertTerms: false,
        canMutateSharedWatchlists: false,
        canAssignCases: false,
        canDryRunWebhookDelivery: false,
        canReadWebhookDeliverySummary: true,
    })
    expect(receipt.after).toEqual({
        role: 'editor',
        canReadSharedWatchlists: true,
        canExportAlertTerms: false,
        canMutateSharedWatchlists: true,
        canAssignCases: false,
        canDryRunWebhookDelivery: false,
        canReadWebhookDeliverySummary: true,
    })
    expect(receipt.downstreamReadinessReceipt.before).toEqual({
        sharedWatchlistReadReady: true,
        alertGenerationExportReady: false,
        watchlistMutationReady: false,
        caseAssignmentReady: false,
        webhookDeliveryReady: false,
        deliverySummaryReady: true,
    })
    expect(receipt.downstreamReadinessReceipt.after).toEqual({
        sharedWatchlistReadReady: true,
        alertGenerationExportReady: false,
        watchlistMutationReady: true,
        caseAssignmentReady: false,
        webhookDeliveryReady: false,
        deliverySummaryReady: true,
    })
    expect(receipt.downstreamReadinessReceipt.roleGates.mutateWatchlists).toEqual(['owner', 'admin', 'editor'])
})
test('member mutations lock user rows in stable order before the organization row', async () => {
    state.role = 'owner'
    const responses = [
        await app.inject({ method: 'PATCH', url: '/org/org/members/a-target/role', payload: { role: 'editor', reason: 'Grant access.' } }),
        await app.inject({ method: 'DELETE', url: '/org/org/members/a-target' }),
        await app.inject({ method: 'POST', url: '/org/org/ownership-transfer', payload: { targetUserId: 'a-target', reason: 'Transfer ownership.' } }),
    ]

    expect(responses.map(response => response.statusCode)).toEqual([200, 200, 200])
    expect(responses[0].json().roleChange).toMatchObject({ previousRole: 'reader', newRole: 'editor' })
    expect(responses[1].json().memberRemovalCleanup).toMatchObject({
        targetUserId: 'a-target',
        noOrphanedInviteTokens: true,
        consumerAccessRevocation: { blockerCode: 'member_revoked' },
    })
    expect(responses[2].json().transfer).toEqual({
        organizationId: 'org',
        previousOwnerId: 'actor',
        newOwnerId: 'a-target',
        reason: 'Transfer ownership.',
    })
    const userLocks = state.statements.flatMap((statement, index) => statement.sql.includes('FROM users WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE') ? [index] : [])
    const organizationLocks = state.statements.flatMap((statement, index) => statement.sql === 'SELECT id FROM organizations WHERE id = $1 FOR UPDATE' ? [index] : [])

    expect(userLocks).toHaveLength(3)
    expect(organizationLocks).toHaveLength(3)
    userLocks.forEach((userLock, index) => {
        expect(organizationLocks[index]).toBe(userLock + 1)
        expect(state.statements[userLock].params).toEqual([['a-target', 'actor']])
        expect(state.statements[organizationLocks[index]].params).toEqual(['org'])
    })
})
test('member role changes revalidate the actor membership after locking', async () => {
    state.role = 'owner'
    state.removeActorMembershipAfterMemberLock = true

    const response = await app.inject({
        method: 'PATCH',
        url: '/org/org/members/a-target/role',
        payload: { role: 'editor', reason: 'Grant access.' },
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Organization not found.' })
    expect(state.actorMembershipStatus).toBe('removed')
    expect(state.statements.some(statement => statement.sql.startsWith('SELECT id FROM users WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE'))).toBe(true)
    expect(state.writes).toHaveLength(0)
})
