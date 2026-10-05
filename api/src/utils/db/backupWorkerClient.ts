import { BackupOperationError } from './backupOperationError.ts'

export function usesBackupWorker() {
    return Boolean(process.env.DB_BACKUP_WORKER_URL)
}

export async function backupWorkerCall<T>(method: string, args: unknown[]): Promise<T> {
    const baseUrl = process.env.DB_BACKUP_WORKER_URL?.replace(/\/$/, '')
    const token = process.env.DB_BACKUP_WORKER_TOKEN
    if (!baseUrl || !token) throw new BackupOperationError('The database backup service is not configured.', 503)
    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ method, args }),
            signal: AbortSignal.timeout(30 * 60 * 1000),
        })
        const body = await response.json() as { value?: T, error?: string }
        if (!response.ok) throw new BackupOperationError(body.error || 'Backup operation failed.', response.status)
        return body.value as T
    } catch (error) {
        if (error instanceof BackupOperationError) throw error
        throw new BackupOperationError('The database backup service is unavailable. Try again shortly.', 503)
    }
}
