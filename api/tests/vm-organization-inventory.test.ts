import { expect, mock, test } from 'bun:test'
import Fastify from 'fastify'

const queries: Array<{ sql: string, params: unknown[] }> = []
let organizationId: string | null = null
let organizationMember = true
let globalAdmin = false

mock.module('#utils/vms/access.ts', () => ({
    vmViewer: async () => ({ id: 'cashflow-member', admin: globalAdmin }),
    requireVmAccess: async () => ({ id: 'cashflow-member', admin: false, name: 'cashflow-vm' }),
}))
mock.module('#utils/contentOrganization.ts', () => ({
    requestedContentOrganization: () => organizationId,
    contentOrganizationAccess: async (requested: string) => organizationMember && requested === organizationId,
}))
mock.module('#utils/vms/status.ts', () => ({ withLiveVmStatus: async (vm: unknown) => vm, withLiveVmStatuses: async (vms: unknown[]) => vms }))
mock.module('#utils/vms/shareManagement.ts', () => ({ withShareManagement: async (vms: unknown[]) => vms }))
mock.module('#utils/loadSQL.ts', () => ({ loadSQL: async (filename: string) => filename }))
mock.module('#db', () => ({ default: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    return { rows: ['getVmByIdInOrganization.sql', 'getVmsByOrganization.sql', 'getVmsByUser.sql'].includes(sql)
        ? [{ name: 'cashflow-vm', owner: 'vm-owner', organization_id: 'cashflow' }]
        : [] }
} }))

const { default: getVM } = await import('../src/handlers/vms/get.ts')

const app = Fastify()
app.get('/vms/:user', getVM)
app.get('/vm/:id', getVM)

test('VM inventory in an organization workspace returns only that organization’s VMs', async () => {
    organizationId = 'cashflow'
    organizationMember = true
    globalAdmin = false
    queries.length = 0

    const response = await app.inject('/vms/cashflow-member')

    expect(response.statusCode).toBe(200)
    expect(queries).toHaveLength(1)
    expect(queries[0]?.sql).toBe('getVmsByOrganization.sql')
    expect(queries[0]?.params).toEqual(['cashflow', 'cashflow-member'])
    expect(response.json()[0]?.can_delete).toBe(false)
})

test('VM inventory rejects an organization workspace the viewer cannot access', async () => {
    organizationId = 'cashflow'
    organizationMember = false
    globalAdmin = false
    queries.length = 0

    const response = await app.inject('/vms/cashflow-member')

    expect(response.statusCode).toBe(403)
    expect(queries).toHaveLength(0)
})

test('personal VM inventory keeps the existing user access scope', async () => {
    organizationId = null
    organizationMember = true
    globalAdmin = false
    queries.length = 0

    const response = await app.inject('/vms/cashflow-member')

    expect(response.statusCode).toBe(200)
    expect(queries).toHaveLength(1)
    expect(queries[0]?.sql).toBe('getVmsByUser.sql')
    expect(queries[0]?.params).toEqual(['cashflow-member'])
    expect(response.json()[0]?.can_delete).toBe(false)
})

test('global administrators receive VM deletion capability in inventory responses', async () => {
    organizationId = 'cashflow'
    organizationMember = true
    globalAdmin = true
    const response = await app.inject('/vms/cashflow-member')
    expect(response.statusCode).toBe(200)
    expect(response.json()[0]?.can_delete).toBe(true)
    globalAdmin = false
})

test('VM detail lookup in an organization workspace includes the selected organization', async () => {
    organizationId = 'cashflow'
    organizationMember = true
    globalAdmin = false
    queries.length = 0

    const response = await app.inject('/vm/cashflow-vm')

    expect(response.statusCode).toBe(200)
    expect(queries).toHaveLength(1)
    expect(queries[0]?.sql).toBe('getVmByIdInOrganization.sql')
    expect(queries[0]?.params).toEqual(['cashflow-vm', 'cashflow'])
})
