import type { AutomationRow, AutomationScheduleKind } from './automationTypes.ts'

export function computeNextRunAt({
    scheduleKind,
    intervalMinutes,
    runAt,
    from,
}: {
    scheduleKind: AutomationScheduleKind
    intervalMinutes: number | null
    runAt: Date | null
    from: Date
}) {
    if (scheduleKind === 'once') {
        return runAt && runAt.getTime() >= from.getTime() - 1000 ? runAt : null
    }

    if (runAt && runAt.getTime() >= from.getTime() - 1000) return runAt
    const minutes = Math.max(1, intervalMinutes || 60)
    // Match the minute-based cron ticks so check duration does not skip the next tick.
    return new Date((Math.floor(from.getTime() / 60_000) + minutes) * 60_000)
}

export function nextRunAfterExecution(automation: Pick<AutomationRow, 'schedule_kind' | 'interval_minutes'>) {
    return automation.schedule_kind === 'interval'
        ? computeNextRunAt({
            scheduleKind: automation.schedule_kind,
            intervalMinutes: automation.interval_minutes,
            runAt: null,
            from: new Date(),
        })
        : null
}
