import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

type Vm = {
    name: string
    owner: string
    created_by: string
    organization_id: string | null
    access_users: string[] | null
}

const initialVm: Vm = {
    name: 'shared-vm',
    owner: 'owner',
    created_by: 'creator',
    organization_id: null,
    access_users: ['member', ' member ', 'owner', 'collaborator', '', 'creator'],
}
const queries: Array<{ sql: string, params?: unknown[] }> = []
const syncCalls: Array<{ vmName: string, userIds: string[] }> = []
let vm = structuredClone(initialVm)
let manageableUsers = new Set(['owner', 'creator', 'member'])
const syncResult = { certificates: ['ssh-ed25519 test'], received: 1, added: 1, total: 1 }

mock.module('../src/utils/auth/tokenWrapper.ts', () => ({
    default: async (req: any) => ({ valid: Boolean(req.headers.id), id: req.headers.id }),
}))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({
    default: async (req: any) => ({ valid: req.headers.id === 'admin' }),
}))
mock.module('../src/utils/db.ts', () => ({
    default: async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params })
        return { rows: sql.includes('WHERE v.name = $1') && params?.[0] === vm.name ? [structuredClone(vm)] : [] }
    },
}))
mock.module('../src/utils/vms/access.ts', () => ({
    hasVmAccess: async (_name: string, userId: string, manage = false) => !manage || manageableUsers.has(userId),
}))
mock.module('../src/utils/vms/syncUserCertificatesToVm.ts', () => ({
    default: async ({ vmName, userIds }: { vmName: string, userIds: string[] }) => {
        syncCalls.push({ vmName, userIds })
        return syncResult
    },
}))
mock.module('../src/utils/logs/recordLog.ts', () => ({ default: async () => {} }))

const { default: postAgentTargetSyncAccess } = await import('../src/handlers/vms/postAgentTargetSyncAccess.ts')
const app = Fastify()
app.post('/vm/:id/agent-target/sync-access', postAgentTargetSyncAccess)

beforeEach(() => {
    vm = structuredClone(initialVm)
    manageableUsers = new Set(['owner', 'creator', 'member'])
    queries.length = 0
    syncCalls.length = 0
})
afterAll(() => app.close())

test('current-user scope lets a shared member synchronize only their own key', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/vm/shared-vm/agent-target/sync-access',
        headers: { id: 'member' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
        ok: true,
        scope: 'current_user',
        triggeredBy: 'member',
        syncedUserIds: ['member'],
        certificateCount: 1,
        received: 1,
        added: 1,
        total: 1,
    })
    expect(syncCalls).toEqual([{ vmName: 'shared-vm', userIds: ['member'] }])
})

test('all-user scope rejects shared managers but permits owner and creator with deduplicated recipients', async () => {
    const denied = await app.inject({
        method: 'POST',
        url: '/vm/shared-vm/agent-target/sync-access',
        headers: { id: 'member' },
        payload: { scope: 'all_access_users' },
    })
    expect(denied.statusCode).toBe(403)
    expect(syncCalls).toHaveLength(0)

    const owner = await app.inject({
        method: 'POST',
        url: '/vm/shared-vm/agent-target/sync-access',
        headers: { id: 'owner' },
        payload: { scope: 'all_access_users' },
    })
    expect(owner.statusCode).toBe(200)
    expect(owner.json().syncedUserIds).toEqual(['owner', 'creator', 'member', 'collaborator'])
    expect(syncCalls).toEqual([{
        vmName: 'shared-vm',
        userIds: ['owner', 'creator', 'member', 'collaborator'],
    }])

    syncCalls.length = 0
    const creator = await app.inject({
        method: 'POST',
        url: '/vm/shared-vm/agent-target/sync-access',
        headers: { id: 'creator' },
        payload: { scope: 'all_access_users' },
    })
    expect(creator.statusCode).toBe(200)
    expect(creator.json().syncedUserIds).toEqual(['owner', 'creator', 'member', 'collaborator'])
    expect(syncCalls).toEqual([{
        vmName: 'shared-vm',
        userIds: ['owner', 'creator', 'member', 'collaborator'],
    }])
})

test('system admin syncs the selected organization access users', async () => {
    vm = {
        name: 'organization-vm',
        owner: 'original-owner',
        created_by: 'creator',
        organization_id: 'org-1',
        access_users: ['org-owner', 'org-admin'],
    }
    const response = await app.inject({
        method: 'POST',
        url: '/vm/organization-vm/agent-target/sync-access',
        headers: { id: 'admin' },
        payload: { scope: 'all_access_users' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().syncedUserIds).toEqual(['org-owner', 'org-admin'])
    expect(syncCalls).toEqual([{
        vmName: 'organization-vm',
        userIds: ['org-owner', 'org-admin'],
    }])
})
