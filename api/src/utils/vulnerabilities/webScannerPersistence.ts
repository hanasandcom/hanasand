import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { queryOnce, withTransaction } from '#db'
import { DEFAULT_INTERVAL_MINUTES, MAX_HISTORY, STATE_PATH, TARGET_ID, fallbackExplanation, isUsefulExplanation, normalizeTarget, emptySeverityCounts, type WebScanCheck, type WebScanReport, type WebScanRun, type WebScanSchedule, type ConfiguredTarget, type StoredRun, type StoredFinding } from './webScannerModel.ts'

export async function insertRun(run: WebScanRun) {
    await queryOnce(`INSERT INTO web_scan_runs (scan_id, target_id, target_url, status, target_status, started_at, finished_at, duration_ms, severity_counts, error)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
        ON CONFLICT (scan_id) DO NOTHING`, [run.scanId, TARGET_ID, run.target, run.status, run.targets[0]?.status || 'pending', run.startedAt, run.finishedAt, run.durationMs, JSON.stringify(run.severityCounts), run.error])
}

export async function finishRun(previousSchedule: WebScanSchedule, run: WebScanRun, updateSchedule = true) {
    const schedule = { ...previousSchedule, lastRunAt: run.finishedAt, nextRunAt: previousSchedule.enabled ? new Date(Date.now() + previousSchedule.intervalMinutes * 60_000).toISOString() : null }
    await withTransaction(async query => {
        await query('UPDATE web_scan_runs SET status = $2, target_status = $3, finished_at = $4, duration_ms = $5, severity_counts = $6::jsonb, error = $7 WHERE scan_id = $1', [run.scanId, run.status, run.targets[0]?.status || 'error', run.finishedAt, run.durationMs, JSON.stringify(run.severityCounts), run.error])
        for (const target of run.targets) {
            for (const check of target.checks) {
                await query('INSERT INTO web_scan_findings (scan_id, target_url, kind, check_id, status, severity, title, explanation, evidence) VALUES ($1, $2, \'check\', $3, $4, $5, $6, $7, $8::jsonb) ON CONFLICT (scan_id, check_id) DO UPDATE SET status = EXCLUDED.status, severity = EXCLUDED.severity, title = EXCLUDED.title, explanation = EXCLUDED.explanation, evidence = EXCLUDED.evidence', [run.scanId, target.target, check.id, check.status, check.severity, check.title, check.explanation || null, JSON.stringify(check.evidence)])
            }
            for (const port of target.ports) {
                await query('INSERT INTO web_scan_findings (scan_id, target_url, kind, check_id, status, severity, title, evidence, port, elapsed_ms) VALUES ($1, $2, \'port\', $3, $4, \'info\', $5, $6::jsonb, $7, $8) ON CONFLICT (scan_id, check_id) DO UPDATE SET status = EXCLUDED.status, title = EXCLUDED.title, evidence = EXCLUDED.evidence, port = EXCLUDED.port, elapsed_ms = EXCLUDED.elapsed_ms', [run.scanId, target.target, `service.port.${port.port}`, port.open ? 'warn' : 'pass', `Port ${port.port} ${port.open ? 'is open' : 'is closed'}`, JSON.stringify({ open: port.open }), port.port, port.elapsedMs])
            }
        }
    })
    if (updateSchedule) await writeSchedule(schedule, run.error)
    return run
}
export async function readReport(): Promise<WebScanReport> {
    const configured = await getConfiguredTarget()
    const schedule = await readSchedule(configured.target)
    if (configured.error) return { current: null, history: [], schedule, error: configured.error }
    try {
        await migrateLegacyHistory(configured.target!)
        const runs = await loadRuns()
        return { current: runs.find(run => run.status === 'running') || null, history: runs.filter(run => run.status !== 'running'), schedule, error: null }
    } catch (error) {
        return { current: null, history: [], schedule, error: error instanceof Error ? error.message : 'Web scan database is unavailable.' }
    }
}

async function getConfiguredTarget(): Promise<ConfiguredTarget> {
    try {
        const result = await queryOnce('SELECT target_url FROM web_scan_targets WHERE id = $1 AND enabled = TRUE', [TARGET_ID])
        if (!result.rows[0]) return { target: null, error: 'No enabled web scan target is configured.' }
        const target = normalizeTarget(result.rows[0].target_url)
        return target ? { target, error: null } : { target: null, error: 'The configured web scan target is invalid.' }
    } catch {
        return { target: null, error: 'Web scan target configuration is unavailable.' }
    }
}
async function readSchedule(target: string | null): Promise<WebScanSchedule> {
    const empty: WebScanSchedule = { enabled: true, intervalMinutes: DEFAULT_INTERVAL_MINUTES, nextRunAt: new Date().toISOString(), lastRunAt: null, target, scope: 'global' }
    try {
        const parsed = JSON.parse(await readFile(STATE_PATH, 'utf8')) as { schedule?: Partial<WebScanSchedule> }
        return { ...empty, ...(parsed.schedule || {}), target, scope: 'global' }
    } catch { return empty }
}

export async function writeSchedule(schedule: WebScanSchedule, error: string | null) {
    await mkdir(path.dirname(STATE_PATH), { recursive: true })
    const temporaryPath = `${STATE_PATH}.${process.pid}.${randomUUID()}.tmp`
    try {
        await writeFile(temporaryPath, JSON.stringify({ schedule, error }, null, 2), 'utf8')
        await rename(temporaryPath, STATE_PATH)
    } finally { await rm(temporaryPath, { force: true }) }
}

async function migrateLegacyHistory(target: string) {
    const count = await queryOnce('SELECT COUNT(*)::int AS count FROM web_scan_runs')
    if (Number(count.rows[0]?.count || 0) > 0) return
    let parsed: { history?: WebScanRun[] }
    try { parsed = JSON.parse(await readFile(STATE_PATH, 'utf8')) as { history?: WebScanRun[] } } catch { return }
    for (const run of (parsed.history || []).slice(0, MAX_HISTORY)) {
        const migrated = { ...run, target, targets: run.targets.map(item => ({ ...item, target })) }
        await insertRun(migrated)
        await finishRun({ enabled: false, intervalMinutes: DEFAULT_INTERVAL_MINUTES, nextRunAt: null, lastRunAt: run.finishedAt, target, scope: 'global' }, migrated, false)
    }
}

async function loadRuns(): Promise<WebScanRun[]> {
    const runs = await queryOnce('SELECT scan_id, target_url, status, target_status, started_at, finished_at, duration_ms, severity_counts, error FROM web_scan_runs ORDER BY started_at DESC LIMIT $1', [MAX_HISTORY])
    if (!runs.rows.length) return []
    const findings = await queryOnce('SELECT scan_id, target_url, kind, check_id, status, severity, title, explanation, evidence, port, elapsed_ms FROM web_scan_findings WHERE scan_id = ANY($1::text[]) ORDER BY id', [runs.rows.map(row => row.scan_id)])
    return runs.rows.map(row => runFromRows(row as StoredRun, findings.rows.filter(finding => finding.scan_id === row.scan_id) as StoredFinding[]))
}

function runFromRows(row: StoredRun, findings: StoredFinding[]): WebScanRun {
    const checks = findings.filter(finding => finding.kind === 'check').map(finding => ({ id: finding.check_id, status: finding.status as WebScanCheck['status'], severity: finding.severity, title: finding.title, explanation: finding.explanation || undefined, evidence: finding.evidence }))
    const ports = findings.filter(finding => finding.kind === 'port' && finding.port !== null).map(finding => ({ port: finding.port!, open: finding.status !== 'pass', elapsedMs: finding.elapsed_ms || 0 }))
    return { scanId: row.scan_id, status: row.status, startedAt: new Date(row.started_at).toISOString(), finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null, durationMs: row.duration_ms, target: row.target_url, targets: [{ target: row.target_url, status: row.target_status, checks, ports }], severityCounts: row.severity_counts || emptySeverityCounts(), error: row.error }
}

export function hydrateReport(report: WebScanReport): WebScanReport {
    const hydrateRun = (run: WebScanRun | null): WebScanRun | null => run ? { ...run, targets: run.targets.map(target => ({ ...target, checks: target.checks.map(check => ({ ...check, explanation: isUsefulExplanation(check.explanation) ? check.explanation : fallbackExplanation(check) })) })) } : null
    return { ...report, current: hydrateRun(report.current), history: report.history.map(run => hydrateRun(run)!).filter(Boolean) }
}
