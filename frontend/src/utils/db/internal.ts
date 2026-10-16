'use server'

import { requestService } from '@/utils/monitoring/serviceApi'

import type { DatabaseHealth, DatabaseOverview, DatabaseQueryResult } from './databaseTypes'
import type { BackupDashboard, BackupFile, BackupOperation, BackupService } from './backupTypes'
export type { DatabaseHealth, DatabaseOverview, DatabaseQueryActivity, DatabaseQueryResult } from './databaseTypes'
export type { BackupDashboard, BackupFile, BackupIntegrity, BackupOperation, BackupRetentionOutcome, BackupService } from './backupTypes'

const backupDataCache = { revalidate: 30, tags: ['database-backups'] }

const DATABASE_OVERVIEW_CACHE_MS = 10_000
let cachedDatabaseOverview: { value: DatabaseOverview, refreshedAt: number } | null = null
let refreshingDatabaseOverview: Promise<DatabaseOverview | string> | null = null

function refreshDatabaseOverview() {
    if (refreshingDatabaseOverview) return refreshingDatabaseOverview
    const refresh = requestService<DatabaseOverview>('internal', 'db?summary=1', { cache: 'no-store' }).then(value => {
        if (typeof value !== 'string' && value.status === 'healthy') {
            cachedDatabaseOverview = { value, refreshedAt: Date.now() }
        }
        return value
    }).finally(() => {
        if (refreshingDatabaseOverview === refresh) refreshingDatabaseOverview = null
    })
    refreshingDatabaseOverview = refresh
    return refresh
}

export async function getDatabaseOverview() {
    if (!cachedDatabaseOverview) return refreshDatabaseOverview()

    const age = Date.now() - cachedDatabaseOverview.refreshedAt
    if (age >= DATABASE_OVERVIEW_CACHE_MS) {
        // Page authorization runs in the proxy for every request; reuse this shared telemetry while it refreshes.
        void refreshDatabaseOverview().catch(() => undefined)
    }

    return cachedDatabaseOverview.value
}

export async function getDatabaseQueries() {
    return await requestService<Pick<DatabaseOverview, 'queries' | 'longestQuery'>>('internal', 'db', { cache: 'no-store' })
}

export async function getDatabaseHealth() {
    return await requestService<DatabaseHealth>('internal', 'db/health')
}

export async function runDatabaseSql(sql: string) {
    return await requestService<DatabaseQueryResult>('internal', 'db/query', {
        method: 'POST',
        body: JSON.stringify({ sql }),
    })
}

export async function getDatabaseRows(schema: string, table: string, limit: number) {
    const params = new URLSearchParams({ schema, table, limit: String(limit) })
    return await requestService<DatabaseQueryResult>('internal', `db/rows?${params.toString()}`)
}

export async function getBackupServices() {
    return await requestService<BackupService[]>('internal', 'backup', undefined, backupDataCache)
}

export async function getBackupDashboard() {
    return await requestService<BackupDashboard>('internal', 'backup/dashboard', undefined, backupDataCache)
}

export async function getBackupFiles(service?: string, date?: string) {
    const params = new URLSearchParams()
    if (service) params.set('service', service)
    if (date) params.set('date', date)
    const suffix = params.toString()
    return await requestService<BackupFile[]>('internal', `backup/files${suffix ? `?${suffix}` : ''}`, undefined, backupDataCache)
}

export async function triggerDatabaseBackup() {
    return await requestService<{ message: string, operation: BackupOperation }>('internal', 'backup', {
        method: 'POST',
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10 * 60 * 1000),
    })
}

export async function deleteDatabaseBackup(file: string) {
    return await requestService<{ message: string, operation: BackupOperation }>('internal', 'backup/delete', {
        method: 'POST',
        body: JSON.stringify({ file }),
    })
}

export async function restoreDatabaseBackup(file: string, targetDatabase: string, confirmation: string) {
    return await requestService<{ message: string, operation: BackupOperation }>('internal', 'backup/restore', {
        method: 'POST',
        body: JSON.stringify({ file, targetDatabase, confirmation }),
    })
}

export async function restoreDatabaseBackupToLive(file: string, confirmation: string) {
    return await requestService<{ message: string, operation: BackupOperation }>('internal', 'backup/restore-live', {
        method: 'POST',
        body: JSON.stringify({ file, confirmation }),
        signal: AbortSignal.timeout(30 * 60 * 1000),
    })
}
