import type { ReactNode } from 'react'
import { Zap } from 'lucide-react'
import type { ManagedCronJob } from '@/utils/systemCron/client'

export type CronSummary = {
    total: number
    enabled: number
    running: number
    failed: number
    pending: number
    hourly: number | null
    daily: number | null
}

export function summarizeCronJobs(jobs: ManagedCronJob[]): CronSummary {
    const enabled = jobs.filter(job => job.enabled).length
    const running = jobs.filter(job => job.running || job.status === 'running').length
    const failed = jobs.filter(job => job.status === 'failed' || job.status === 'blocked' || job.failureCount > 0).length
    const pending = jobs.filter(job => job.status === 'unknown').length
    return {
        total: jobs.length, enabled, running, failed, pending,
        hourly: sumMoney(jobs.map(job => job.costEstimate.hourlyUsd)),
        daily: sumMoney(jobs.map(job => job.costEstimate.dailyUsd)),
    }
}

export function primaryHeadline(summary: CronSummary) {
    if (!summary.total) return 'No scheduled jobs available'
    if (summary.pending) return 'Live job state is loading'
    if (summary.failed === 1) return '1 job needs review'
    if (summary.failed) return `${summary.failed} jobs need review`
    if (summary.running) return `${summary.running} job${summary.running === 1 ? '' : 's'} running now`
    return 'All scheduled jobs operating normally'
}

export function needsAttention(job: ManagedCronJob) {
    return job.status === 'failed' || job.status === 'blocked' || job.failureCount > 0
}

export function StatusPill({ job }: { job: ManagedCronJob }) {
    const tone = job.status === 'failed' || job.status === 'blocked'
        ? 'border-ui-danger bg-ui-raised/15 text-ui-text'
        : job.status === 'running'
            ? 'border-ui-primary bg-ui-primary/15 text-ui-primary'
            : job.enabled
                ? 'border-ui-success bg-ui-success/15 text-ui-success'
                : 'border-ui-border bg-ui-raised text-ui-muted'
    return <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${tone}`}>{operationalStateLabel(job.status)}</span>
}

export function CostPill({ job }: { job: ManagedCronJob }) {
    const daily = job.costEstimate.dailyUsd
    const tone = daily === null
        ? 'border-ui-border bg-ui-raised text-ui-muted'
        : daily >= 1
            ? 'border-ui-danger bg-ui-raised/15 text-ui-text'
            : daily >= 0.25
                ? 'border-ui-warning bg-ui-warning/15 text-ui-warning'
                : 'border-ui-success bg-ui-success/15 text-ui-success'
    return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${tone}`} title={job.costEstimate.assumption}>
        <Zap className='h-3.5 w-3.5' />{money(daily)}/day
    </span>
}

export function Info({ icon, label, value, mono = false }: { icon: ReactNode, label: string, value: string, mono?: boolean }) {
    return <div className='grid gap-1 rounded-lg border border-ui-border bg-ui-raised p-3'>
        <div className='flex items-center gap-2 text-ui-muted'>{icon}<span className='text-xs font-semibold uppercase'>{label}</span></div>
        <p className={`${mono ? 'font-mono text-xs' : 'text-sm'} break-words text-ui-text`}>{value}</p>
    </div>
}

export function cadenceLabel(job: ManagedCronJob) {
    if (job.cadenceSeconds) return secondsSchedule(job.cadenceSeconds)
    return job.schedule
}

export function controlLabel(job: ManagedCronJob) {
    if (job.controlMode === 'observable_only') return 'Audit only'
    if (job.controlMode === 'run_only') return 'Run now supported'
    if (job.controlMode === 'editable') return 'Pause/resume and schedule edit'
    return job.controls.includes('run_now') ? 'Safe pause/resume and run now' : 'Safe pause/resume'
}

export function reliabilityLabel(job: ManagedCronJob) {
    if (job.failureCount) return `${job.failureCount} failure${job.failureCount === 1 ? '' : 's'} · ${job.lastError || 'see logs'}`
    if (job.lastSuccessAt) return `Last success ${timeLabel(job.lastSuccessAt)}`
    return 'No failures reported'
}

export function resourceLabel(job: ManagedCronJob) {
    const parts = [
        job.resourceUsage.memoryRssMb !== null ? `${job.resourceUsage.memoryRssMb} MB RSS` : '',
        job.resourceUsage.memoryUsedMb !== null ? `${job.resourceUsage.memoryUsedMb} MB heap` : '',
        job.resourceUsage.queueDepth !== null ? `${job.resourceUsage.queueDepth} queued` : '',
    ].filter(Boolean)
    return parts.length ? `${parts.join(' · ')} (${job.resourceUsage.scope})` : job.resourceUsage.note
}

export function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'blocked'
    if (value === 'needs_action' || value === 'action_required') return 'reviewing'
    return value.replaceAll('_', ' ')
}

export function timeLabel(value: string | null) {
    if (!value) return 'watching'
    return new Date(value).toLocaleString()
}

export function duration(value: number | null) {
    if (!value) return ''
    if (value < 1000) return `${value}ms`
    const seconds = Math.round(value / 1000)
    if (seconds < 60) return `${seconds}s`
    return `${Math.round(seconds / 60)}m`
}

export function money(value: number | null) {
    return typeof value === 'number' ? `$${value.toFixed(value < 0.01 ? 4 : 2)}` : 'metering'
}

function secondsSchedule(seconds: number) {
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    return `${Math.round(minutes / 60)}h`
}

function sumMoney(values: Array<number | null>) {
    const available = values.filter((value): value is number => typeof value === 'number')
    if (!available.length) return null
    return Math.round(available.reduce((sum, value) => sum + value, 0) * 10000) / 10000
}
