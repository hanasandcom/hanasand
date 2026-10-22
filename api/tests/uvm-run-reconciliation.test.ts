import { expect, mock, test } from 'bun:test'

const dbCalls: Array<{ sql: string, values: unknown[] }> = []
mock.module('#db', () => ({ default: async(sql: string, values: unknown[] = []) => {
    dbCalls.push({ sql, values })
    if (sql.includes('FROM uvm_network_runs')) return { rows: [{ id: 'local-network', scanner_run_id: 'network-1' }] }
    if (sql.includes('FROM uvm_tenable_runs')) return { rows: [{ id: 'local-tenable', scanner_run_id: 'tenable-1' }] }
    if (sql.includes('SELECT 1 FROM uvm_finding_sync_runs')) return { rows: [] }
    return { rows: [] }
} }))
mock.module('#utils/auth/organizationPagePolicy.ts', () => ({ HANASAND_ORGANIZATION_ID: 'org-1' }))
mock.module('#utils/db/uvmScannerSchema.ts', () => ({ default: async() => {} }))
mock.module('../src/utils/vulnerabilities/scanner.ts', () => ({
    cancelGvmRun: async() => ({}),
    cancelNetworkScannerRun: async() => ({}),
    cancelTenableRun: async() => ({}),
    getGvmRun: async() => ({}),
    getNetworkScannerRun: async() => ({ status: 'succeeded', error: null, startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:01:00.000Z' }),
    getTenableIntegration: async() => ({}),
    getTenableScans: async() => ({ scans: [] }),
    getTenableRun: async() => ({
        runId: 'tenable-1', requestId: 'request-1', organizationId: 'org-1', assetId: 'asset-1', target: 'example.com',
        addresses: ['8.8.8.8'], scanId: 'scan-1', status: 'succeeded', createdAt: '2026-01-01T00:00:00.000Z',
        startedAt: '2026-01-01T00:00:00.000Z', finishedAt: '2026-01-01T00:01:00.000Z', error: null, findings: [],
        coverage: { attemptedAddresses: 1, completedAddresses: 1 },
    }),
    removeTenableIntegration: async() => ({}),
    setTenableIntegration: async() => ({}),
    startGvmRun: async() => ({}),
    startNetworkScannerRun: async() => ({}),
    startTenableRun: async() => ({}),
}))
mock.module('../src/utils/vulnerabilities/webScanner.ts', () => ({ getWebScanReport: async() => ({ history: [], current: null }) }))

const { reconcileUvmRuns } = await import('../src/utils/vulnerabilities/uvmScanner/findings.ts')

test('scheduled reconciliation persists terminal run state and imports completed Tenable runs', async() => {
    dbCalls.length = 0

    await expect(reconcileUvmRuns()).resolves.toEqual({ reconciled: 2 })

    const networkUpdate = dbCalls.find(call => call.sql.includes('UPDATE uvm_network_runs SET status'))
    const tenableUpdate = dbCalls.find(call => call.sql.includes('UPDATE uvm_tenable_runs SET status'))
    expect(networkUpdate?.values.slice(0, 2)).toEqual(['local-network', 'succeeded'])
    expect(tenableUpdate?.values.slice(0, 2)).toEqual(['local-tenable', 'succeeded'])
    expect(dbCalls.some(call => call.sql.includes('INSERT INTO uvm_finding_sync_runs') && call.values.includes('tenable-1'))).toBe(true)
})
