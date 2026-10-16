import { afterEach, mock } from 'bun:test'
import { lockTails, ledger, receiverAudits, queries, resetDwmWebhookRetryState, setDatabaseRun, state } from './dwm-webhook-report-retry-state.ts'
import { readDeliveryRows, readReceiverAudits } from './dwm-webhook-report-retry-reads.ts'
import { writeDelivery, writeReceiverReceipt } from './dwm-webhook-report-retry-writes.ts'

const databaseRun = async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    return readDeliveryRows(sql, params)
        ?? readReceiverAudits(sql, params)
        ?? writeReceiverReceipt(sql, params)
        ?? writeDelivery(sql, params)
        ?? { rows: [] }
}
setDatabaseRun(databaseRun)

mock.module('#db', () => ({
    withTransaction: async <T>(work: (query: typeof databaseRun) => Promise<T>) => {
        const ledgerLength = ledger.length
        const priorInserted = state.insertedDelivery
        const priorReceiptIds = receiverAudits.map(row => row.delivery_id)
        try {
            return await work(databaseRun)
        } catch (error) {
            ledger.splice(ledgerLength)
            state.insertedDelivery = priorInserted
            receiverAudits.forEach((row, index) => { row.delivery_id = priorReceiptIds[index] })
            throw error
        }
    },
    withDatabaseAdvisoryLock: async <T>(key: string, work: () => Promise<T>) => {
        const previous = lockTails.get(key) || Promise.resolve()
        let release = () => {}
        const current = new Promise<void>(resolve => { release = resolve })
        lockTails.set(key, previous.then(() => current))
        await previous
        try { return await work() } finally { release() }
    },
    default: databaseRun,
}))

afterEach(resetDwmWebhookRetryState)
