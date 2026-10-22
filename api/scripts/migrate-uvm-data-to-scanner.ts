import { withTransaction } from '#db'
import { HANASAND_ORGANIZATION_ID } from '../src/utils/auth/organizationPagePolicy.ts'
import { requestUvmService } from '../src/utils/vulnerabilities/scanner.ts'
import { exportUvmMigration, migrationIdFor, type SqlQuery } from '../src/utils/vulnerabilities/uvmMigrationExport.ts'

async function main() {
    const target = process.argv.find(value => value.startsWith('--target='))?.slice('--target='.length)
    const execute = process.argv.includes('--execute')
    const confirmed = process.argv.includes('--confirm-cutover')
    if (!execute || !['staging', 'production'].includes(target || '') || (target === 'production' && !confirmed)) {
        throw new Error('Usage: bun scripts/migrate-uvm-data-to-scanner.ts --target=staging|production --execute [--confirm-cutover for production]')
    }

    const payload = await withTransaction(query => exportUvmMigration(query as SqlQuery, HANASAND_ORGANIZATION_ID), { timeoutMs: 120_000, statementTimeoutMs: 60_000 })
    const rowCount = Object.values(payload).reduce((total, rows) => total + rows.length, 0)
    if (!rowCount) {
        console.info(`No legacy UVM rows to import for ${target}.`)
        return
    }
    const migrationId = migrationIdFor(payload)
    const result = await requestUvmService<{ imported?: Record<string, number>, migrationId: string }>(
        `/v1/uvm/migration/import?organizationId=${encodeURIComponent(HANASAND_ORGANIZATION_ID)}`,
        { method: 'POST', body: { organizationId: HANASAND_ORGANIZATION_ID, migrationId, ...payload }, timeoutMs: 120_000 },
    )
    console.info(JSON.stringify({ target, migrationId: result.migrationId, imported: result.imported || {}, sourceRows: rowCount }))
}

if (import.meta.main) {
    main().catch(error => {
        console.error('UVM migration stopped; source rows were not deleted.', error instanceof Error ? error.message : String(error))
        process.exitCode = 1
    })
}
