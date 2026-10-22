import { expect, test } from 'bun:test'
import { exportUvmMigration, migrationIdFor } from '../src/utils/vulnerabilities/uvmMigrationExport.ts'

test('exports all organization UVM rows in a repeatable read-only snapshot', async() => {
    const calls: Array<{ sql: string, params?: unknown[] }> = []
    const rowsByTable: Record<string, Record<string, unknown>[]> = {
        uvm_assets: [{ id: 'asset-1', organization_id: 'org-1', verification_token: 'secret-dns-token', authorized_addresses: ['8.8.8.8'] }],
        uvm_network_runs: [{ id: 'run-1', organization_id: 'org-1', scanner_run_id: 'scanner-run-1' }],
        uvm_tenable_runs: [],
        uvm_assessments: [{ id: 'assessment-1', organization_id: 'org-1', steps: [{ id: 'step-1' }] }],
        uvm_findings: [{ id: 'finding-1', organization_id: 'org-1', triage_note: 'Review after deployment' }],
        uvm_finding_observations: [{ id: 'observation-1', organization_id: 'org-1', run_id: 'run-1' }],
    }
    const query = async(sql: string, params?: unknown[]) => {
        calls.push({ sql, params })
        const table = Object.keys(rowsByTable).find(name => sql.includes(`FROM ${name}`))
        return { rows: table ? rowsByTable[table]! : [] }
    }

    const payload = await exportUvmMigration(query, 'org-1')

    expect(calls[0]?.sql).toBe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    expect(calls.slice(1).every(call => call.params?.[0] === 'org-1')).toBe(true)
    expect(payload.assets[0]).toMatchObject({ organizationId: 'org-1', verificationToken: 'secret-dns-token', authorizedAddresses: ['8.8.8.8'] })
    expect(payload.networkRuns[0]).toMatchObject({ scannerRunId: 'scanner-run-1' })
    expect(payload.assessments[0]).toMatchObject({ steps: [{ id: 'step-1' }] })
    expect(payload.findings[0]).toMatchObject({ triageNote: 'Review after deployment' })
    expect(payload.observations[0]).toMatchObject({ runId: 'run-1' })
    expect(payload).toHaveProperty('triageHistory', [])
    expect(calls.every(call => /^SELECT|^SET TRANSACTION/.test(call.sql))).toBe(true)
})

test('derives a stable migration key from the exported snapshot', () => {
    const snapshot = { assets: [{ id: 'asset-1' }], findings: [] }
    expect(migrationIdFor(snapshot)).toBe(migrationIdFor(snapshot))
    expect(migrationIdFor(snapshot)).not.toBe(migrationIdFor({ ...snapshot, findings: [{ id: 'finding-1' }] }))
})
