import type { BackupOperation, BackupService } from '@/utils/db/internal'

export function backupErrorMessage(value?: string | null) {
    // Historical operation records can retain the earlier worker restart wording.
    if (value === 'The backup worker restarted before this operation reached a terminal state.') {
        return 'The backup worker restarted before the backup finished.'
    }
    if (value === 'The backup service needs attention. Check API logs for the database backup operation.') {
        return 'The previous backup failure did not retain its cause. Backups remain paused until the database size is reduced.'
    }
    return value || undefined
}

export function BackupStatus({ value }: { value: string }) {
    const normalized = value.toLowerCase()
    const isSuccess = normalized === 'succeeded' || normalized === 'healthy'
    const isFailure = ['failed', 'interrupted', 'unavailable'].includes(normalized)
    const color = isSuccess ? 'text-ui-success' : isFailure ? 'text-ui-text' : 'text-ui-warning'

    return (
        <span className={`rounded-full border border-current/25 px-2 py-1 text-xs font-semibold capitalize ${color}`}>
            {value.replaceAll('_', ' ')}
        </span>
    )
}

export function retentionLabel(service?: BackupService) {
    const outcome = service?.retentionOutcome
    if (!outcome) return 'No completed retention pass yet'
    const slots = (outcome.retained || []).flatMap(point => point.slots)
    const daily = new Set(slots.filter(slot => slot.startsWith('day:'))).size
    const weekly = new Set(slots.filter(slot => slot.startsWith('week:'))).size
    return `Kept ${daily} daily + ${weekly} weekly checkpoints; deleted ${outcome.deleted}`
}

export function operationLabel(operation: BackupOperation) {
    if (operation.kind === 'restore_drill') return `Restore drill → ${operation.targetDatabase || 'isolated target'}`
    if (operation.kind === 'restore_live') return `Live restore · ${operation.trigger}`
    if (operation.kind === 'delete') return `Delete backup · ${operation.trigger}`
    if (operation.kind === 'verify') return `Checksum verification · ${operation.trigger}`
    return `Backup · ${operation.trigger}`
}

export function stageLabel(value: string) {
    return value.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())
}

export function formatDuration(value: number | null) {
    if (value === null) return '—'
    return value < 1000 ? `${value}ms` : `${Math.round(value / 1000)}s`
}

export function shortHash(value?: string | null) {
    return value ? value.slice(0, 12) : 'Not reported'
}
