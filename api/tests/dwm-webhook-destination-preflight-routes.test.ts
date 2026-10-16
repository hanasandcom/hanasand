import { beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import * as webhookUtils from '../src/utils/dwm/webhooks.ts'

const buildDestinationCrudContract = webhookUtils.buildDwmWebhookDestinationCrudContract
let destination: Record<string, any>
const destinationMutations: string[] = []
const preflightInputs: Array<Record<string, any>> = []
const db = async (sql: string) => {
    if (sql.includes('FROM dwm_webhook_destinations')) {
        return { rows: [{ id: 'destination_1', org_id: 'org_1' }] }
    }
    if (sql.includes('FROM organization_members member')) {
        return { rows: [{ role: 'admin', organization_status: 'active', privacy_deletion_run_id: null }] }
    }
    throw new Error(`Unexpected DWM webhook preflight query: ${sql}`)
}

mock.module('#db', () => ({ default: db }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'owner_1' }) }))
mock.module('#utils/dwm/webhooks.ts', () => ({
    ...webhookUtils,
    listDwmWebhookDestinations: async () => [destination],
    listDwmWebhookDeliveries: async () => [],
    listDwmWebhookAuditEvents: async () => [],
    buildDwmWebhookDestinationCrudContract: (input: Record<string, any>) => {
        preflightInputs.push(input)
        if (input.destination && input.input?.orgId !== input.destination.orgId) {
            return buildDestinationCrudContract(input as Parameters<typeof buildDestinationCrudContract>[0])
        }
        return { action: input.action, canApply: false, blockers: [{ message: 'Preflight blocked for route test.' }] } as any
    },
    updateDwmWebhookDestination: async (_ownerId: string, _destinationId: string, input: Record<string, any>) => {
        destinationMutations.push('update')
        destination = { ...destination, ...input }
        return destination
    },
    archiveDwmWebhookDestination: async () => {
        destinationMutations.push('delete')
        return { ...destination, status: 'archived' }
    },
    testDwmWebhookDestination: async () => {
        destinationMutations.push('test')
        return null
    },
}))

const { deleteDwmWebhookDestination, postDwmWebhookDestinationTest, putDwmWebhookDestination } = await import('../src/handlers/dwm/webhooks.ts')
const app = Fastify()
app.delete('/targets/:id', deleteDwmWebhookDestination)
app.put('/targets/:id', putDwmWebhookDestination)
app.post('/targets/:id/test', postDwmWebhookDestinationTest)

beforeEach(() => {
    destination = {
        id: 'destination_1',
        ownerId: 'owner_1',
        orgId: 'org_1',
        name: 'Research receiver',
        kind: 'webhook',
        endpointHint: 'receiver.example/…',
        endpointHash: 'endpoint_hash_1',
        status: 'active',
        events: ['dwm.alert.updated'],
        createdBy: 'owner_1',
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestError: null,
        lastTestHttpStatus: null,
        lastDeliveryAt: null,
        createdAt: '2026-10-16T10:00:00.000Z',
        updatedAt: '2026-10-16T10:00:00.000Z',
        signingConfigured: false,
    }
    destinationMutations.length = 0
    preflightInputs.length = 0
})

test('destination update preflight reports update and enable actions from current and requested status', async () => {
    const updateResponse = await app.inject({
        method: 'PUT',
        url: '/targets/destination_1',
        payload: { status: 'paused' },
    })
    expect(updateResponse.statusCode).toBe(400)
    expect(updateResponse.json().destinationCrud.action).toBe('update')
    expect(preflightInputs[0]).toMatchObject({
        action: 'update',
        ownerId: 'owner_1',
        input: { status: 'paused', orgId: 'org_1' },
        destination,
        destinations: [destination],
        deliveries: [],
        auditEvents: [],
        viewerRole: 'admin',
        canManage: true,
    })
    expect(destinationMutations).toEqual([])

    destination = { ...destination, status: 'paused' }
    const enableResponse = await app.inject({
        method: 'PUT',
        url: '/targets/destination_1',
        payload: { status: 'active' },
    })
    expect(enableResponse.statusCode).toBe(400)
    expect(enableResponse.json().destinationCrud.action).toBe('enable')
    expect(preflightInputs[1].action).toBe('enable')
    expect(destinationMutations).toEqual([])
})

test('destination update cannot move an existing destination to another organization', async () => {
    const response = await app.inject({
        method: 'PUT',
        url: '/targets/destination_1',
        payload: { orgId: 'org_2', status: 'paused' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().destinationCrud.canApply).toBe(false)
    expect(response.json().destinationCrud.blockingCodes).toEqual(['org_scope_mismatch'])
    expect(preflightInputs[0].input.orgId).toBe('org_2')
    expect(destinationMutations).toEqual([])
})

test('destination test preflight returns its blocker contract without invoking the test action', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/targets/destination_1/test',
        payload: { orgId: 'attacker_org', alertId: 'alert_1' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().destinationCrud.action).toBe('test')
    expect(response.json().destinationCrud.canApply).toBe(false)
    expect(preflightInputs[0].input).toEqual({ orgId: 'org_1', alertId: 'alert_1' })
    expect(destinationMutations).toEqual([])
})

test('destination delete preflight uses its authorized organization and does not archive when blocked', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/targets/destination_1' })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
        error: 'Preflight blocked for route test.',
        destinationCrud: { action: 'delete', canApply: false },
    })
    expect(preflightInputs[0]).toMatchObject({
        action: 'delete',
        ownerId: 'owner_1',
        input: { orgId: 'org_1' },
        destination,
        destinations: [destination],
        deliveries: [],
        auditEvents: [],
        viewerRole: 'admin',
        canManage: true,
    })
    expect(destinationMutations).toEqual([])
})
