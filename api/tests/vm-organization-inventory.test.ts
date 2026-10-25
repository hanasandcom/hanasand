import { expect, mock, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import Fastify from 'fastify'

const queries: Array<{ sql: string, params: unknown[] }> = []
let organizationId: string | null = null
let organizationMember = true

mock.module('#utils/vms/access.ts', () => ({
    vmViewer: async () => ({ id: 'cashflow-member', admin: false }),
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
    return { rows: sql === 'getVmByIdInOrganization.sql' ? [{ name: 'cashflow-vm', organization_id: 'cashflow' }] : [] }
} }))

const { default: getVM } = await import('../src/handlers/vms/get.ts')
const { default: getAccessibleVMs } = await import('../src/handlers/vms/getAccessibleVMs.ts')

const app = Fastify()
app.get('/vms/:user', getVM)
app.get('/vms/access/:user', getAccessibleVMs)
app.get('/vm/:id', getVM)

test('VM inventory in an organization workspace returns only that organization’s VMs', async () => {
    organizationId = 'cashflow'
    organizationMember = true
    queries.length = 0

    const response = await app.inject('/vms/cashflow-member')

    expect(response.statusCode).toBe(200)
    expect(queries).toHaveLength(1)
    expect(queries[0]?.sql).toBe('getVmsByOrganization.sql')
    expect(queries[0]?.params).toEqual(['cashflow', 'cashflow-member'])
})

test('VM inventory rejects an organization workspace the viewer cannot access', async () => {
    organizationId = 'cashflow'
    organizationMember = false
    queries.length = 0

    const response = await app.inject('/vms/cashflow-member')

    expect(response.statusCode).toBe(403)
    expect(queries).toHaveLength(0)
})

test('personal VM inventory limits results to VMs accessible to the user', async () => {
    organizationId = null
    organizationMember = true
    queries.length = 0

    const response = await app.inject('/vms/cashflow-member')

    expect(response.statusCode).toBe(200)
    expect(queries).toHaveLength(1)
    expect(queries[0]?.sql).toBe('getVmsByUser.sql')
    expect(queries[0]?.params).toEqual(['cashflow-member'])
})

test('personal VM inventory query excludes organization-owned VMs', async () => {
    const query = await readFile(new URL('../src/queries/getVmsByUser.sql', import.meta.url), 'utf8')

    expect(query).toMatch(/WHERE\s+v\.organization_id\s+IS NULL\s+AND\s+vm_user_has_access\(v\.name,\s*\$1\)/)
})

test('personal accessible-VM endpoint excludes organization-owned VMs', async () => {
    organizationId = null
    queries.length = 0

    const response = await app.inject('/vms/access/cashflow-member')

    expect(response.statusCode).toBe(200)
    expect(queries).toHaveLength(1)
    expect(queries[0]?.sql.replace(/\s+/g, ' ')).toContain('WHERE organization_id IS NULL AND vm_user_has_access(name, $1)')
    expect(queries[0]?.params).toEqual(['cashflow-member'])
})

test('VM detail lookup in an organization workspace includes the selected organization', async () => {
    organizationId = 'cashflow'
    organizationMember = true
    queries.length = 0

    const response = await app.inject('/vm/cashflow-vm')

    expect(response.statusCode).toBe(200)
    expect(queries).toHaveLength(1)
    expect(queries[0]?.sql).toBe('getVmByIdInOrganization.sql')
    expect(queries[0]?.params).toEqual(['cashflow-vm', 'cashflow'])
})
