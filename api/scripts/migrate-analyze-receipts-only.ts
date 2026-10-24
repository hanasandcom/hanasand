import { logsOutboxEnabled, logsOutboxRemoteOnly, logsServiceConfiguration } from '../src/utils/logs/logOutboxConfig.ts'
import { assertMigrationStorageReserve, migrateReceiptKind, runMigrationTailVacuum, serviceReady } from './migrate-logs-to-service.ts'

const tailChunkBytes = 4 * 1024 ** 3

async function main() {
    if (process.env.LOGS_MIGRATION_ANALYZE_RECEIPTS_ONLY !== '1') {
        throw new Error('Set LOGS_MIGRATION_ANALYZE_RECEIPTS_ONLY=1 to run the receipt-only migration.')
    }
    if (!logsOutboxEnabled() || !logsOutboxRemoteOnly()) {
        throw new Error('Analysis receipt migration requires enabled remote-only Logs delivery.')
    }
    const { url, syncToken } = logsServiceConfiguration()
    if (!url || !syncToken || syncToken.length < 32) throw new Error('Logs API URL and sync token are required.')
    await assertMigrationStorageReserve()
    if (!await serviceReady(url)) throw new Error('Logs API or worker is unhealthy; no receipts were moved.')
    const migrated = await migrateReceiptKind(url, syncToken, 'analyze', runMigrationTailVacuum, tailChunkBytes, tailChunkBytes)
    console.log(JSON.stringify({ complete: true, migrated, scope: 'analysis receipts' }))
}

if (import.meta.main) {
    main().catch(error => {
        console.error('Analysis receipt migration stopped; source rows without verified Logs acknowledgements remain in Hanasand.',
            error instanceof Error ? error.message : 'unknown error')
        process.exitCode = 1
    })
}
