import { backupWorkerCall } from './backupWorkerClient.ts'
export { BackupOperationError } from './backupOperationError.ts'

type BackupLocation = 'local'
type BackupOperationKind = 'backup' | 'verify' | 'restore_drill' | 'restore_live'
type BackupOperationStatus = 'running' | 'succeeded' | 'failed' | 'interrupted'

type IntegritySummary = {
    schemas: number
    tables: number
    estimatedRows: number
}

type BackupMetadata = {
    schemaVersion: 'hanasand.database_backup.v1'
    file: string
    database: string
    createdAt: string
    verifiedAt: string
    checksumSha256: string
    sizeBytes: number
    durationMs: number
    archiveEntries: number
    sourceIntegrity: IntegritySummary
    releaseCommit: string | null
}

type RetentionOutcome = {
    policyDays: number
    examined: number
    deleted: number
    deletedBytes: number
    cutoffAt: string
    retained: Array<{ file: string, slots: string[] }>
}

export type BackupOperation = {
    id: string
    kind: BackupOperationKind
    trigger: 'manual' | 'schedule'
    actorId: string
    status: BackupOperationStatus
    stage: string
    startedAt: string
    finishedAt: string | null
    durationMs: number | null
    file: string | null
    targetDatabase: string | null
    checksumSha256: string | null
    sizeBytes: number | null
    archiveEntries: number | null
    sourceIntegrity: IntegritySummary | null
    restoredIntegrity: IntegritySummary | null
    targetRemoved: boolean | null
    retention: RetentionOutcome | null
    error: string | null
    releaseCommit: string | null
}

type BackupState = {
    schemaVersion: 'hanasand.database_backup_state.v1'
    configuration: {
        enabled: boolean
        paused: boolean
        schedule: string
        timezone: 'UTC'
        nextRunAt: string | null
        retentionDays: number
        storageTarget: string
        statePath: string
        scheduleError: string | null
        updatedAt: string
    }
    operations: BackupOperation[]
}

type BackupCandidate = {
    file: string
    path: string
    mtime: Date
    sizeBytes: number
    location: BackupLocation
    metadata: BackupMetadata | null
}

export type BackupServiceStatus = {
    id: string
    name: string
    database: string
    status: string
    error?: string | null
    dbSize?: string
    totalStorage?: string
    lastBackup?: string | null
    lastAttempt?: string | null
    lastSuccess?: string | null
    lastFailure?: string | null
    lastError?: string | null
    nextBackup?: string | null
    schedule?: string
    scheduleTimezone?: string
    scheduleEnabled?: boolean
    retention?: string | null
    retentionOutcome?: RetentionOutcome | null
    storageTarget?: string | null
    statePath?: string | null
    latestFile?: string | null
    latestSize?: string | null
    latestDuration?: string | null
    latestChecksum?: string | null
    latestVerifiedAt?: string | null
    healthCheck?: string | null
    releaseCommit?: string | null
    currentOperation?: BackupOperation | null
    operations: BackupOperation[]
}

export type BackupFileEntry = {
    service: string
    file: string
    mtime?: string | null
    size?: string
    sizeBytes?: number
    location?: BackupLocation
    checksumSha256?: string | null
    verifiedAt?: string | null
    verified: boolean
    releaseCommit?: string | null
}

export const DATABASE_BACKUP_JOB_ID = 'api-database-backup'

export const collectDatabaseBackupServices = () => backupWorkerCall<BackupServiceStatus[]>('status', [])
export const listDatabaseBackupFiles = (service?: string, date?: string) => backupWorkerCall<BackupFileEntry[]>('files', [service ?? null, date ?? null])
export const createDatabaseBackup = (options: { actorId?: string, trigger?: 'manual' | 'schedule' } = {}) => backupWorkerCall<BackupOperation>('create', [options])
export const verifyDatabaseBackupFile = (file: string, actorId = 'system') => backupWorkerCall<BackupOperation>('verify', [file, actorId])
export const restoreDatabaseBackupFile = (input: { file: string, targetDatabase: string, confirmation: string, actorId?: string }) => backupWorkerCall<BackupOperation>('restore', [input])
export const restoreDatabaseBackupToLive = (input: { file: string, confirmation: string, actorId?: string }) => backupWorkerCall<BackupOperation>('restore-live', [input])
export const runDueDatabaseBackup = (now = new Date()) => backupWorkerCall<BackupOperation | null>('due', [now.toISOString()])
export const setDatabaseBackupSchedulePaused = (paused: boolean) => backupWorkerCall<void>('pause', [paused])

export function sanitizeBackupError(error: unknown) {
    if (error instanceof BackupOperationError) return error.message
    const statusCode = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 0
    return statusCode === 503
        ? 'The database backup service is unavailable. Try again shortly.'
        : 'The database backup service failed. Check its status before retrying.'
}
