import { randomUUID } from 'node:crypto'
import { withWebScanLock } from './webScannerLock.ts'
import { readReport, finishRun } from './webScannerPersistence.ts'
import { insertRun } from './webScannerPersistence.ts'
import { checkPort, dnsCheck, explainChecks, headerChecks, redirectChecks, cookieChecks, tlsCertificateCheck } from './webScannerChecks.ts'
import { PORTS, countSeverities, emptySeverityCounts, type WebScanRun, type WebScanTargetResult } from './webScannerModel.ts'

export async function runWebScan(): Promise<WebScanRun> {
    return withWebScanLock(async() => {
        const report = await readReport()
        if (report.error || !report.schedule.target) throw new Error(report.error || 'No enabled scanner target is configured.')
        const scanId = `webscan_${randomUUID()}`
        const startedAt = new Date().toISOString()
        const current: WebScanRun = { scanId, status: 'running', startedAt, finishedAt: null, durationMs: null, target: report.schedule.target, targets: [], severityCounts: emptySeverityCounts(), error: null }
        await insertRun(current)
        try {
            const targets = [await scanTarget(report.schedule.target, scanId)]
            const finishedAt = new Date().toISOString()
            const completed: WebScanRun = { ...current, status: 'completed', finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt), targets, severityCounts: countSeverities(targets), error: null }
            return await finishRun(report.schedule, completed)
        } catch (error) {
            const finishedAt = new Date().toISOString()
            const failed: WebScanRun = { ...current, status: 'failed', finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt), error: error instanceof Error ? error.message : String(error) }
            return await finishRun(report.schedule, failed)
        }
    })
}
export async function scanTarget(target: string, scanId: string): Promise<WebScanTargetResult> {
    const url = new URL(target)
    const headers = { 'user-agent': 'Hanasand-Security-Scanner/1.0 (+https://hanasand.com/security-scanner)', 'x-hanasand-scan-id': scanId }
    const checks = [await dnsCheck(url.hostname), await tlsCertificateCheck(url.hostname)]
    let status = 'error'
    try {
        const started = performance.now()
        const response = await fetch(url, { method: 'GET', headers, redirect: 'manual', signal: AbortSignal.timeout(12_000) })
        status = String(response.status)
        const responseHeaders = Object.fromEntries(response.headers.entries())
        checks.push({ id: 'http.reachable', status: 'pass', severity: 'info', title: 'HTTPS request completed', evidence: { status: response.status, elapsedMs: Math.round(performance.now() - started) } })
        checks.push(...redirectChecks(response.status, responseHeaders.location, url))
        checks.push(...headerChecks(responseHeaders, url.protocol === 'https:'))
        checks.push(...cookieChecks(responseHeaders['set-cookie']))
    } catch (error) {
        checks.push({ id: 'http.reachable', status: 'error', severity: 'high', title: 'HTTPS request completed', evidence: { error: error instanceof Error ? error.message : String(error) } })
    }
    const ports = await Promise.all(PORTS.map(port => checkPort(url.hostname, port)))
    return { target, status, checks: await explainChecks(checks), ports }
}
