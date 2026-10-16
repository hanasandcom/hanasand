export type BackupService = {
    id: string
    name: string
    database?: string
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
    retentionOutcome?: BackupRetentionOutcome | null
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

export type BackupRetentionOutcome = {
    policyDays: number
    examined: number
    deleted: number
    deletedBytes: number
    cutoffAt: string
    retained?: Array<{ file: string, slots: string[] }>
}

export type BackupIntegrity = {
    schemas: number
    tables: number
    estimatedRows: number
}

export type BackupOperation = {
    id: string
    kind: 'backup' | 'verify' | 'delete' | 'restore_drill' | 'restore_live'
    trigger: 'manual' | 'schedule'
    actorId: string
    status: 'running' | 'succeeded' | 'failed' | 'interrupted'
    stage: string
    startedAt: string
    finishedAt: string | null
    durationMs: number | null
    file: string | null
    targetDatabase: string | null
    checksumSha256: string | null
    sizeBytes: number | null
    archiveEntries: number | null
    sourceIntegrity: BackupIntegrity | null
    restoredIntegrity: BackupIntegrity | null
    targetRemoved: boolean | null
    retention: BackupRetentionOutcome | null
    error: string | null
    releaseCommit: string | null
}

export type BackupFile = {
    service: string
    file: string
    mtime?: string | null
    size?: string
    sizeBytes?: number
    location?: 'local' | 'remote'
    checksumSha256?: string | null
    verifiedAt?: string | null
    verified: boolean
    releaseCommit?: string | null
}

export type BackupDashboard = {
    backups: BackupService[]
    files: BackupFile[]
    errors: string[]
}
