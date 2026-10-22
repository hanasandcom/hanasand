import { createHash } from 'node:crypto'

export type SqlQuery = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>

export async function exportUvmMigration(query: SqlQuery, organizationId: string) {
    await query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const [assets, networkRuns, tenableRuns, assessments, findings, observations] = await Promise.all([
        query('SELECT * FROM uvm_assets WHERE organization_id = $1 ORDER BY id', [organizationId]),
        query('SELECT * FROM uvm_network_runs WHERE organization_id = $1 ORDER BY id', [organizationId]),
        query('SELECT * FROM uvm_tenable_runs WHERE organization_id = $1 ORDER BY id', [organizationId]),
        query(`SELECT a.*, COALESCE(json_agg(to_jsonb(s) ORDER BY s.created_at, s.id) FILTER (WHERE s.id IS NOT NULL), '[]'::json) AS steps
            FROM uvm_assessments a LEFT JOIN uvm_assessment_steps s
              ON s.assessment_id = a.id AND s.organization_id = a.organization_id
            WHERE a.organization_id = $1 GROUP BY a.id ORDER BY a.id`, [organizationId]),
        query('SELECT * FROM uvm_findings WHERE organization_id = $1 ORDER BY id', [organizationId]),
        query('SELECT * FROM uvm_finding_observations WHERE organization_id = $1 ORDER BY id', [organizationId]),
    ])
    return {
        assets: assets.rows.map(toScannerRecord),
        networkRuns: networkRuns.rows.map(toScannerRecord),
        tenableRuns: tenableRuns.rows.map(toScannerRecord),
        assessments: assessments.rows.map(row => ({ ...toScannerRecord(row), steps: Array.isArray(row.steps) ? row.steps.map(step => toScannerRecord(step as Record<string, unknown>)) : [] })),
        findings: findings.rows.map(toScannerRecord),
        observations: observations.rows.map(toScannerRecord),
        triageHistory: [],
    }
}

function toScannerRecord(row: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value]))
}

export function migrationIdFor(payload: unknown) {
    const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    const bytes = Buffer.from(digest.slice(0, 32), 'hex')
    bytes[6] = (bytes[6]! & 0x0f) | 0x50
    bytes[8] = (bytes[8]! & 0x3f) | 0x80
    const uuid = bytes.toString('hex')
    return `${uuid.slice(0, 8)}-${uuid.slice(8, 12)}-${uuid.slice(12, 16)}-${uuid.slice(16, 20)}-${uuid.slice(20)}`
}
