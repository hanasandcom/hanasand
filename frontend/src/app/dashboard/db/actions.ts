'use server'

import { updateTag } from 'next/cache'
import { getDatabaseHealth, getDatabaseRows, restoreDatabaseBackup, restoreDatabaseBackupToLive, runDatabaseSql, triggerDatabaseBackup, verifyDatabaseBackup } from '@/utils/db/internal'

function refreshBackupData<T>(response: T | string) {
    if (typeof response !== 'string') updateTag('database-backups')
    return response
}

export async function triggerBackupAction() {
    return refreshBackupData(await triggerDatabaseBackup())
}

export async function verifyBackupAction(file: string) {
    return refreshBackupData(await verifyDatabaseBackup(file))
}

export async function restoreBackupAction(file: string, targetDatabase: string, confirmation: string) {
    return refreshBackupData(await restoreDatabaseBackup(file, targetDatabase, confirmation))
}

export async function restoreLiveBackupAction(file: string, confirmation: string) {
    return refreshBackupData(await restoreDatabaseBackupToLive(file, confirmation))
}

export async function databaseHealthAction() {
    return await getDatabaseHealth()
}

export async function databaseRowsAction(schema: string, table: string, limit: number) {
    return await getDatabaseRows(schema, table, limit)
}

export async function databaseSqlAction(sql: string) {
    return await runDatabaseSql(sql)
}
