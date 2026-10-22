import { expect, mock, test } from 'bun:test'

const dbCalls: Array<{ sql: string, values: unknown[] }> = []
const authorizedAddresses = ['8.8.8.8']
let resolvedAddresses = authorizedAddresses
let networkScanError: Error | null = null
let networkScanInput: Record<string, unknown> | null = null
let startedTenableInput: Record<string, unknown> | null = null
let tenableScanError: Error | null = null
let dueScheduleEngine: 'nmap' | 'tenable-vm' = 'nmap'
let dueScheduleScanId: string | null = null
let tenableScans: Array<{ id: string, enabled: boolean }> = [{ id: '101', enabled: true }]
const assetRow = {
    id: 'asset-1', hostname: 'example.com', verification_method: 'internal', verification_status: 'verified',
    verification_token: '', verified_at: new Date(0), scan_authorized_at: null, authorized_addresses: ['8.8.8.8'],
    schedule_enabled: false, schedule_engine: 'nmap', schedule_scan_id: null, interval_minutes: 60, next_run_at: null, created_at: new Date(0),
}

mock.module('#db', () => ({ default: async(sql: string, values: unknown[] = []) => {
    dbCalls.push({ sql, values })
    if (sql.includes('UPDATE uvm_assets SET next_run_at = NOW() + (interval_minutes')) return { rows: [{ id: 'asset-1', created_by: 'owner-1', schedule_engine: dueScheduleEngine, schedule_scan_id: dueScheduleScanId }] }
    if (sql.includes('FROM uvm_assets WHERE id = $1')) return { rows: [assetRow] }
    if (sql.includes('INSERT INTO uvm_network_runs')) return { rows: [{ id: 'local-network-run-1' }] }
    if (sql.includes('INSERT INTO uvm_tenable_runs')) return { rows: [{ id: 'local-run-1' }] }
    if (sql.includes('UPDATE uvm_assets SET schedule_enabled')) return { rows: [{ ...assetRow, schedule_enabled: values[2], interval_minutes: values[3], schedule_engine: values[8], schedule_scan_id: values[9], verification_token: '' }] }
    return { rows: [] }
} }))
mock.module('#utils/auth/organizationPagePolicy.ts', () => ({ HANASAND_ORGANIZATION_ID: 'org-1' }))
mock.module('#utils/db/uvmScannerSchema.ts', () => ({ default: async() => {} }))
mock.module('../src/utils/vulnerabilities/uvmScope.ts', () => ({
    normalizeUvmHostname: (value: unknown) => String(value).trim().toLowerCase(),
    parseAuthorizedAddresses: (value: unknown) => Array.isArray(value) ? value : [],
    resolvePublicUvmAddresses: async() => resolvedAddresses,
    sameAuthorizedAddressSet: (left: string[], right: string[]) => left.length === right.length && left.every(value => right.includes(value)),
}))
mock.module('../src/utils/vulnerabilities/uvmScannerClient.ts', () => ({
    getNetworkScannerRun: async() => null,
    cancelNetworkScannerRun: async() => null,
    startNetworkScannerRun: async(input: Record<string, unknown>) => {
        networkScanInput = input
        if (networkScanError) throw networkScanError
        return { runId: 'network-run-1', requestId: input.requestId, status: 'queued', startedAt: null }
    },
    getTenableIntegration: async() => ({ provider: 'tenable-vm', configured: true }),
    getTenableScans: async() => ({ scans: tenableScans }),
    getTenableRun: async() => null,
    cancelTenableRun: async() => null,
    removeTenableIntegration: async() => ({ removed: true }),
    setTenableIntegration: async() => ({}),
    startTenableRun: async(input: Record<string, unknown>) => { startedTenableInput = input; if (tenableScanError) throw tenableScanError; return { runId: 'remote-run-1', requestId: input.requestId, status: 'queued', startedAt: null } },
}))

const { updateUvmSchedule } = await import('../src/utils/vulnerabilities/uvmScanner/assets.ts')
const { runDueUvmScans, startUvmTenableScan } = await import('../src/utils/vulnerabilities/uvmScanner/runs.ts')

test('Tenable scan starts with the normalized verified asset and the explicitly authorized address set', async() => {
    dbCalls.length = 0
    startedTenableInput = null
    const run = await startUvmTenableScan({ assetId: 'asset-1', actorId: 'owner-1', scanId: '101', authorized: true })

    expect(startedTenableInput).toMatchObject({ organizationId: 'org-1', assetId: 'asset-1', target: 'example.com', addresses: ['8.8.8.8'], scanId: '101' })
    expect(run).toMatchObject({ id: 'local-run-1', runId: 'remote-run-1', engine: 'tenable-vm', target: 'example.com' })
    expect(dbCalls.some(call => call.sql.includes('INSERT INTO uvm_tenable_runs'))).toBe(true)
})

test('asset scheduling reads normalized verification and stored authorization fields', async() => {
    dbCalls.length = 0
    const asset = await updateUvmSchedule({ assetId: 'asset-1', enabled: true, intervalMinutes: 60, authorized: false, actorId: 'owner-1', engine: 'nmap' })
    expect(asset?.scheduleEnabled).toBe(true)
    expect(asset?.scheduleEngine).toBe('nmap')
    expect(dbCalls.some(call => call.sql.includes('UPDATE uvm_assets SET schedule_enabled'))).toBe(true)
})

test('legacy schedule input defaults to Nmap while Tenable schedules store an enabled scan configuration', async() => {
    dbCalls.length = 0
    const legacyAsset = await updateUvmSchedule({ assetId: 'asset-1', enabled: true, intervalMinutes: 60, authorized: false, actorId: 'owner-1' })
    expect(legacyAsset?.scheduleEngine).toBe('nmap')

    dbCalls.length = 0
    const tenableAsset = await updateUvmSchedule({ assetId: 'asset-1', enabled: true, intervalMinutes: 60, authorized: false, actorId: 'owner-1', engine: 'tenable-vm', scanId: '101' })
    const update = dbCalls.find(call => call.sql.includes('UPDATE uvm_assets SET schedule_enabled'))
    expect(tenableAsset?.scheduleEngine).toBe('tenable-vm')
    expect(tenableAsset?.scheduleScanId).toBe('101')
    expect(update?.values.slice(8)).toEqual(['tenable-vm', '101'])

    tenableScans = [{ id: '101', enabled: false }]
    await expect(updateUvmSchedule({ assetId: 'asset-1', enabled: true, intervalMinutes: 60, authorized: false, actorId: 'owner-1', engine: 'tenable-vm', scanId: '101' })).rejects.toThrow('unavailable or disabled')
    tenableScans = [{ id: '101', enabled: true }]
})

test('failed scheduled scan submission retries after a bounded delay', async() => {
    dbCalls.length = 0
    networkScanError = new Error('scanner unavailable')
    networkScanInput = null

    await runDueUvmScans()

    const retry = dbCalls.find(call => call.sql.includes('NOW() + ($3 * INTERVAL \'1 minute\')'))
    expect(networkScanInput).toMatchObject({ assetId: 'asset-1' })
    expect(dbCalls.find(call => call.sql.includes('INSERT INTO uvm_network_runs'))?.values[4]).toBe('scheduled')
    expect(retry?.values).toEqual(['asset-1', 'org-1', 5])
    expect(retry?.sql).toContain('schedule_enabled IS TRUE')
    networkScanError = null
})

test('successful scheduled scan keeps the configured interval and does not schedule a retry', async() => {
    dbCalls.length = 0
    networkScanError = null
    networkScanInput = null

    await runDueUvmScans()

    expect(networkScanInput).toMatchObject({ assetId: 'asset-1' })
    expect(dbCalls.find(call => call.sql.includes('INSERT INTO uvm_network_runs'))?.values[4]).toBe('scheduled')
    expect(dbCalls[0]?.sql).toContain('interval_minutes * INTERVAL \'1 minute\'')
    expect(dbCalls.some(call => call.sql.includes('NOW() + ($3 * INTERVAL \'1 minute\')'))).toBe(false)
})

test('scheduled Tenable run uses the selected scan configuration and scheduled source', async() => {
    dbCalls.length = 0
    dueScheduleEngine = 'tenable-vm'
    dueScheduleScanId = '101'
    startedTenableInput = null

    await runDueUvmScans()

    expect(startedTenableInput).toMatchObject({ assetId: 'asset-1', scanId: '101' })
    expect(dbCalls.find(call => call.sql.includes('INSERT INTO uvm_tenable_runs'))?.values[5]).toBe('scheduled')
    expect(dbCalls.some(call => call.sql.includes('INSERT INTO uvm_network_runs'))).toBe(false)
    dueScheduleEngine = 'nmap'
    dueScheduleScanId = null
})

test('failed scheduled Tenable submission retries after five minutes', async() => {
    dbCalls.length = 0
    dueScheduleEngine = 'tenable-vm'
    dueScheduleScanId = '101'
    tenableScanError = new Error('scanner unavailable')

    await runDueUvmScans()

    const retry = dbCalls.find(call => call.sql.includes('NOW() + ($3 * INTERVAL \'1 minute\')'))
    expect(startedTenableInput).toMatchObject({ assetId: 'asset-1', scanId: '101' })
    expect(dbCalls.find(call => call.sql.includes('INSERT INTO uvm_tenable_runs'))?.values[5]).toBe('scheduled')
    expect(retry?.values).toEqual(['asset-1', 'org-1', 5])
    expect(dbCalls.some(call => call.sql.includes('INSERT INTO uvm_network_runs'))).toBe(false)
    tenableScanError = null
    dueScheduleEngine = 'nmap'
    dueScheduleScanId = null
})

test('changed authorized IP set disables scheduled scanning without scheduling a retry', async() => {
    dbCalls.length = 0
    networkScanInput = null
    resolvedAddresses = ['1.1.1.1']

    await runDueUvmScans()

    expect(networkScanInput).toBe(null)
    expect(dbCalls.some(call => call.sql.includes('SET schedule_enabled = FALSE, next_run_at = NULL'))).toBe(true)
    expect(dbCalls.some(call => call.sql.includes('NOW() + ($3 * INTERVAL \'1 minute\')'))).toBe(false)
    dueScheduleEngine = 'nmap'
    dueScheduleScanId = null
    resolvedAddresses = authorizedAddresses
})

test('changed authorized IP set disables a scheduled Tenable scan before submission', async() => {
    dbCalls.length = 0
    startedTenableInput = null
    dueScheduleEngine = 'tenable-vm'
    dueScheduleScanId = '101'
    resolvedAddresses = ['1.1.1.1']

    await runDueUvmScans()

    expect(startedTenableInput).toBe(null)
    expect(dbCalls.some(call => call.sql.includes('SET schedule_enabled = FALSE, next_run_at = NULL'))).toBe(true)
    expect(dbCalls.some(call => call.sql.includes('NOW() + ($3 * INTERVAL \'1 minute\')'))).toBe(false)
    dueScheduleEngine = 'nmap'
    dueScheduleScanId = null
    resolvedAddresses = authorizedAddresses
})
