import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import type { AgentTargetVmRow } from '../src/utils/vms/agentTargetQuery.ts'

const vms: AgentTargetVmRow[] = [
    {
        name: 'member-vm', owner: 'owner', created_by: 'owner', organization_id: null, access_users: ['member'],
        status: 'RUNNING', type: 'virtual-machine', architecture: 'x86_64', created: '2026-01-01', last_used: '',
        config_image_description: 'Ubuntu', limits_cpu: '2', limits_memory: '2GiB',
        device_eth0_ipv4_address: '192.0.2.10', last_checked: '',
    },
    {
        name: 'private-vm', owner: 'owner', created_by: 'owner', organization_id: null, access_users: [],
        status: 'STOPPED', type: 'virtual-machine', architecture: 'x86_64', created: '2026-01-02', last_used: '',
        config_image_description: 'Debian', limits_cpu: '4', limits_memory: '4GiB',
        device_eth0_ipv4_address: '', last_checked: '',
    },
]

const queries: Array<{ sql: string, params?: unknown[] }> = []
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({
    default: async (req: any) => ({ valid: Boolean(req.headers.id), id: req.headers.id }),
}))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({
    default: async (req: any) => ({ valid: req.headers.id === 'admin' }),
}))
mock.module('../src/utils/db.ts', () => ({
    default: async (sql: string, params?: unknown[]) => {
        queries.push({ sql, params })
        if (sql.includes('WHERE v.name = $1')) return { rows: vms.filter(vm => vm.name === params?.[0]) }
        if (sql.includes('SELECT vm_user_has_access($1, $2) AS allowed')) {
            const userId = String(params?.[1])
            return { rows: [{ allowed: vms.some(vm => vm.name === params?.[0] && (
                vm.owner === userId || vm.created_by === userId || vm.access_users.includes(userId)
            )) }] }
        }
        if (sql.includes('vm_user_has_access(v.name, $1)')) {
            return { rows: vms.filter(vm => vm.owner === params?.[0] || vm.created_by === params?.[0] || vm.access_users.includes(String(params?.[0]))) }
        }
        return { rows: vms }
    },
}))
mock.module('../src/utils/vms/status.ts', () => ({
    withLiveVmStatus: async (vm: AgentTargetVmRow) => vm,
    withLiveVmStatuses: async (rows: AgentTargetVmRow[]) => rows,
}))
mock.module('../src/utils/logs/recordLog.ts', () => ({ default: async () => {} }))

const { default: getAgentTarget } = await import('../src/handlers/vms/getAgentTarget.ts')
const { default: getAgentTargets } = await import('../src/handlers/vms/getAgentTargets.ts')

const app = Fastify()
app.get('/vms/agent/targets', getAgentTargets)
app.get('/vm/:id/agent-target', getAgentTarget)

beforeEach(() => { queries.length = 0 })
afterAll(() => app.close())

test('member list is limited to accessible VMs while admin list includes all VMs', async () => {
    const member = await app.inject({ url: '/vms/agent/targets', headers: { id: 'member' } })
    expect(member.statusCode).toBe(200)
    expect(member.json().scope).toBe('accessible')
    expect(member.json().count).toBe(1)
    expect(member.json().targets.map((target: any) => target.id)).toEqual(['member-vm'])
    expect(member.json().targets[0].capabilities.canManage).toBe(false)
    expect(queries[0].sql).toContain('vm_user_has_access(v.name, $1)')
    expect(queries[0].params).toEqual(['member'])

    const admin = await app.inject({ url: '/vms/agent/targets', headers: { id: 'admin' } })
    expect(admin.statusCode).toBe(200)
    expect(admin.json().scope).toBe('all')
    expect(admin.json().count).toBe(2)
    expect(admin.json().targets.map((target: any) => target.id)).toEqual(['member-vm', 'private-vm'])
    expect(admin.json().targets.every((target: any) => target.capabilities.canManage)).toBe(true)
    expect(queries[1].sql).not.toContain('vm_user_has_access')
})

test('single target allows explicit member access, denies unrelated members, and permits admins', async () => {
    const member = await app.inject({ url: '/vm/member-vm/agent-target', headers: { id: 'member' } })
    expect(member.statusCode).toBe(200)
    expect(member.json().id).toBe('member-vm')
    expect(member.json().capabilities.canConnect).toBe(true)
    expect(member.json().capabilities.canManage).toBe(false)

    const denied = await app.inject({ url: '/vm/private-vm/agent-target', headers: { id: 'member' } })
    expect(denied.statusCode).toBe(403)
    expect(denied.json()).toEqual({ error: 'Forbidden.' })

    const admin = await app.inject({ url: '/vm/private-vm/agent-target', headers: { id: 'admin' } })
    expect(admin.statusCode).toBe(200)
    expect(admin.json().capabilities.canManage).toBe(true)
    expect(admin.json().capabilities.canConnect).toBe(false)
    expect(queries.filter(query => query.sql.includes('SELECT vm_user_has_access($1, $2) AS allowed'))).toHaveLength(2)
})
