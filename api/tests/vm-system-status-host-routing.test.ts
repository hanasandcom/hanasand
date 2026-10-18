import { afterEach, expect, mock, test } from 'bun:test'

const queries: string[] = []
const statusInputs: Array<Record<string, unknown>> = []
mock.module('#db', () => ({ default: async (query: string) => {
    queries.push(query)
    return { rows: query === 'getFullVmList.sql'
        ? [{ name: 'cashflow', primary_host: 'ovhcloud', status: 'Error' }]
        : [{ name: 'cashflow', cpu_usage_percent: 9 }] }
} }))
mock.module('#utils/loadSQL.ts', () => ({ loadSQL: async (name: string) => name }))
mock.module('#utils/vms/status.ts', () => ({ withLiveVmStatus: async (vm: Record<string, unknown>) => {
    statusInputs.push(vm)
    return { ...vm, status: 'RUNNING' }
} }))

const systemVms = (await import('../src/utils/refresh/queries/systemVms.ts')).default

afterEach(() => { queries.length = 0; statusInputs.length = 0 })

test('system VM status uses each VM assigned host instead of the API host LXD inventory', async () => {
    const result = await systemVms()
    expect(statusInputs).toEqual([{ name: 'cashflow', primary_host: 'ovhcloud', status: 'Error' }])
    expect(result.vms[0]).toMatchObject({ name: 'cashflow', primary_host: 'ovhcloud', status: 'RUNNING' })
    expect(result.vmMetrics).toEqual([{ name: 'cashflow', cpu_usage_percent: 9 }])
    expect(queries).toEqual(['getFullVmList.sql', 'getLatestVmMetrics.sql'])
})
