import { withWebScanLock } from './webScannerLock.ts'
import { readReport, writeSchedule, hydrateReport } from './webScannerPersistence.ts'
import { runWebScan } from './webScannerExecution.ts'
import { normalizeIntervalMinutes, type WebScanRun } from './webScannerModel.ts'

let active: Promise<WebScanRun> | null = null

export async function getWebScanReport() {
    return hydrateReport(await readReport())
}

export function startWebScan() {
    if (active) return active
    active = runWebScan().finally(() => { active = null })
    return active
}

export async function runDueWebScan() {
    const report = await readReport()
    if (report.error || !report.schedule.target || !report.schedule.enabled || active) return report
    const next = report.schedule.nextRunAt ? Date.parse(report.schedule.nextRunAt) : 0
    if (next > Date.now()) return report
    void startWebScan().catch(error => console.error('Scheduled Hanasand web scan failed', error))
    return report
}

export async function setWebScanSchedule(input: { enabled?: boolean, intervalMinutes?: number }) {
    return withWebScanLock(async() => {
        const report = await readReport()
        const intervalMinutes = input.intervalMinutes === undefined ? report.schedule.intervalMinutes : normalizeIntervalMinutes(input.intervalMinutes, report.schedule.intervalMinutes)
        const enabled = input.enabled === undefined ? report.schedule.enabled : input.enabled
        const nextRunAt = enabled ? new Date(Date.now() + intervalMinutes * 60_000).toISOString() : null
        const schedule = { ...report.schedule, enabled, intervalMinutes, nextRunAt, scope: 'global' as const }
        await writeSchedule(schedule, report.error)
        return { ...report, schedule }
    })
}

export { withWebScanLock } from './webScannerLock.ts'
export { cookieChecks, headerChecks, redirectChecks } from './webScannerChecks.ts'
export { countSeverities, fallbackExplanation, normalizeIntervalMinutes, normalizeTarget } from './webScannerModel.ts'
export type { WebScanCheck, WebScanReport, WebScanRun, WebScanSchedule, WebScanSeverity, WebScanTargetResult } from './webScannerModel.ts'
