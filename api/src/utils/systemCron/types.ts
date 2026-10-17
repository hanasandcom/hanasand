export type ManagedCronDefinition = {
    id: string
    name: string
    description: string
    defaultSchedule: string
    command: string
    legacyCommands?: string[]
    host: string
    category?: ScheduledJobCategory
    service?: string
    logPath?: string
}

export type ManagedCronJob = ManagedCronDefinition & {
    schedule: string
    enabled: boolean
    installed: boolean
    lastLogLine: string | null
    lastLogAt: string | null
}

export type ManagedCronUpdate = {
    schedule?: unknown
    enabled?: unknown
    action?: unknown
}

export type ScheduledJobCategory = 'TI / Exposure' | 'Alerts' | 'Mail' | 'Backup/Database' | 'Forgejo' | 'Other/System'
export type ScheduledJobControl = 'pause' | 'resume' | 'enable' | 'disable' | 'edit_schedule' | 'run_now'
export type ScheduledJobStatus = 'running' | 'enabled' | 'paused' | 'failed' | 'blocked' | 'observable' | 'unknown'

export type ScheduledJobTelemetry = {
    scope: 'job' | 'service' | 'container' | 'unavailable'
    cpuPercent: number | null
    memoryRssMb: number | null
    memoryUsedMb: number | null
    queueDepth: number | null
    note: string
}

export type ScheduledJobCostEstimate = {
    scope: 'job' | 'service' | 'container' | 'unavailable'
    electricityUsdPerKwh: number
    powerWatts: number | null
    hourlyUsd: number | null
    dailyUsd: number | null
    assumption: string
}

export type UnifiedScheduledJob = {
    id: string
    name: string
    description: string
    category: ScheduledJobCategory
    source: string
    service: string
    schedule: string
    cadenceSeconds: number | null
    enabled: boolean
    running: boolean
    status: ScheduledJobStatus
    installed?: boolean
    command?: string
    host?: string
    logPath?: string
    lastRunAt: string | null
    lastSuccessAt: string | null
    lastFinishedAt: string | null
    nextRunAt: string | null
    currentRunDurationMs: number | null
    averageRuntimeMs: number | null
    failureCount: number
    lastError: string | null
    logExcerpt: string | null
    controls: ScheduledJobControl[]
    controlMode: 'editable' | 'safe_control' | 'run_only' | 'observable_only'
    resourceUsage: ScheduledJobTelemetry
    costEstimate: ScheduledJobCostEstimate
    assumptions: string[]
}
