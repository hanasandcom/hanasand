import { expect, mock, test } from 'bun:test'

const dbCalls: Array<{ sql: string, values: unknown[] }> = []

mock.module('#db', () => ({ default: async(sql: string, values: unknown[] = []) => {
    dbCalls.push({ sql, values })
    if (sql.includes('SELECT 1 FROM uvm_finding_sync_runs')) return { rows: [] }
    if (sql.includes('UPDATE uvm_findings SET status = \'resolved\'')) return { rows: [{ id: 'existing-finding' }] }
    if (sql.includes('SELECT id FROM uvm_assets')) return { rows: [{ id: 'asset-1' }] }
    if (sql.includes('INSERT INTO uvm_findings')) return { rows: [{ id: 'saved-finding' }] }
    return { rows: [] }
} }))
mock.module('#utils/auth/organizationPagePolicy.ts', () => ({ HANASAND_ORGANIZATION_ID: 'org-1' }))

const { importTenableFindings, importWebScanFindings } = await import('../src/utils/vulnerabilities/uvmScanner/findings.ts')

test('partial Tenable output imports observed findings without resolving absent findings', async() => {
    dbCalls.length = 0
    await importTenableFindings({
        runId: 'partial-run', requestId: 'request-1', organizationId: 'org-1', assetId: 'asset-1', target: 'example.com',
        addresses: ['8.8.8.8'], scanId: '101', status: 'partial', createdAt: new Date(0).toISOString(), startedAt: null,
        finishedAt: new Date(0).toISOString(), error: 'Report incomplete.', findings: [{
            findingId: '123:8.8.8.8', provider: 'tenable-vm', pluginId: 123, cveIds: ['CVE-2026-0001'], title: 'Test vulnerability',
            severity: 'high', cvssScore: 8.1, cvssVector: null, description: null, solution: 'Patch it', evidence: 'port/tcp detail',
            assetAddress: '8.8.8.8', firstSeen: null, lastSeen: null, status: 'observed', observed: null, port: 443, protocol: 'tcp',
        }],
    })

    expect(dbCalls.some(call => call.sql.includes('INSERT INTO uvm_findings'))).toBe(true)
    expect(dbCalls.some(call => call.sql.includes('UPDATE uvm_findings SET status = \'resolved\''))).toBe(false)
})

test('complete Tenable coverage resolves absent findings only within the scanned address set', async() => {
    dbCalls.length = 0
    await importTenableFindings({
        runId: 'complete-run', requestId: 'request-2', organizationId: 'org-1', assetId: 'asset-1', target: 'example.com',
        addresses: ['8.8.8.8'], scanId: '101', status: 'succeeded', createdAt: new Date(0).toISOString(), startedAt: null,
        finishedAt: new Date(0).toISOString(), error: null, findings: [], coverage: { attemptedAddresses: 1, completedAddresses: 1 },
    })

    const resolution = dbCalls.find(call => call.sql.includes('UPDATE uvm_findings SET status = \'resolved\''))
    expect(resolution?.values).toEqual(['org-1', 'asset-1', 'complete-run', [], '101', ['8.8.8.8']])
})

test('a later passing web check resolves that check finding and keeps evidence history', async() => {
    dbCalls.length = 0
    const scan = {
        scanId: 'web-scan', status: 'completed', startedAt: new Date(0).toISOString(), finishedAt: new Date(1000).toISOString(),
        durationMs: 1000, target: 'https://example.com', severityCounts: {}, error: null,
        targets: [{ target: 'https://example.com', status: '200', ports: [], checks: [{
            id: 'header.csp', status: 'pass', severity: 'info', title: 'Content-Security-Policy is present',
            evidence: { header: 'content-security-policy', value: 'default-src \'self\'' },
        }] }],
    }
    await importWebScanFindings(scan)

    expect(dbCalls.some(call => call.sql.includes('UPDATE uvm_findings SET status = \'resolved\'') && call.values.includes('https://example.com:header.csp'))).toBe(true)
    expect(dbCalls.some(call => call.sql.includes('INSERT INTO uvm_finding_observations'))).toBe(true)
})
