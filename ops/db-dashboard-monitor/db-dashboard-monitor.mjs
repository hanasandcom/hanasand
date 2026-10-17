import { mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { performance } from 'node:perf_hooks'
import { checkStatusFeed } from './status-feed.mjs'
import { evaluateThreatIntelBackupStatus } from './backup-status.mjs'
import { evaluateDashboardText } from './dashboard-signals.mjs'
import {
    apiBaseUrl, backupMaxAgeHours, backupStatePath, backupStatusPath,
    baseUrl, dashboardPath, failureScreenshotPath, serviceKey,
    statusFeedStatePath, timeoutMs, now,
} from './monitor-config.mjs'
import { MonitorFailure, normalizeFailure } from './monitor-errors.mjs'
import { handleResult } from './monitor-reporting.mjs'
import { authenticateServiceAccount } from './service-account-auth.mjs'
import { runSelfTest } from './monitor-self-test.mjs'

async function loadPlaywright() {
    try {
        return await import('playwright')
    } catch {
        // Reuse the frontend's Playwright installation for this host-side check.
        const requireFromFrontend = createRequire(new URL('../../frontend/package.json', import.meta.url))
        return requireFromFrontend('playwright')
    }
}

async function monitorThreatIntelBackup() {
    const started = performance.now()
    const backup = evaluateThreatIntelBackupStatus(
        await readFile(backupStatusPath, 'utf8').catch(() => ''),
        now,
        backupMaxAgeHours,
    )
    await handleResult({
        ok: backup.ok,
        reason: backup.reason,
        detail: backup.detail,
        latencyMs: Math.round(performance.now() - started),
        metrics: { backupStatus: backup.status, backupFinishedAt: backup.finishedAt },
    }, {
        statePath: backupStatePath,
        service: 'threat-intelligence',
        checkName: 'Backup continuity',
    })
}

async function runMonitor() {
    await handleResult(await checkStatusFeed(`${baseUrl}/api/status`), {
        statePath: statusFeedStatePath,
        service: 'production-monitor',
        checkName: 'Public status feed',
        title: 'Public status monitoring',
        noScreenshot: true,
    })
    await monitorThreatIntelBackup()

    if (!serviceKey) {
        await handleResult({
            ok: false,
            reason: 'missing_credentials',
            detail: 'HANASAND_DB_MONITOR_SERVICE_ACCOUNT_KEY is required.',
            latencyMs: 0,
            metrics: {},
        })
        process.exit(2)
    }

    await monitorDashboard()
}

async function monitorDashboard() {
    const started = performance.now()
    let browser
    let serviceAccountId = ''
    try {
        const { chromium } = await loadPlaywright()
        browser = await chromium.launch({ headless: true })
        const context = await browser.newContext({ viewport: { width: 1280, height: 760 }, ignoreHTTPSErrors: false })
        const page = await context.newPage()
        page.setDefaultTimeout(timeoutMs)
        await authenticateServiceAccount(context, id => { serviceAccountId = id })

        await page.goto(`${baseUrl}${dashboardPath}`, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
        await page.locator('[data-db-monitor-metrics]:visible').waitFor({ state: 'visible', timeout: timeoutMs })
        const bodyText = await page.locator('body').innerText({ timeout: timeoutMs })
        const inventory = await page.locator('[data-db-monitor-metrics]').evaluate(element => ({
            clusters: element.getAttribute('data-clusters'),
            databases: element.getAttribute('data-databases'),
            storageBytes: element.getAttribute('data-storage-bytes'),
        }))
        const signal = evaluateDashboardText(bodyText, inventory)
        if (!signal.ok) throw new MonitorFailure(signal.reason, signal.detail, signal.metrics)

        await handleResult({
            ok: true,
            reason: 'db_dashboard_ok',
            detail: signal.detail,
            latencyMs: Math.round(performance.now() - started),
            metrics: signal.metrics,
        }, {}, serviceAccountId)
    } catch (error) {
        const failure = normalizeFailure(error)
        await captureFailureScreenshot(browser, failure.reason)
        await handleResult({
            ok: false,
            reason: failure.reason,
            detail: failure.detail,
            latencyMs: Math.round(performance.now() - started),
            metrics: failure.metrics,
        }, {}, serviceAccountId)
        process.exit(1)
    } finally {
        await browser?.close().catch(() => {})
    }
}

async function captureFailureScreenshot(browser, reason) {
    if (reason.startsWith('ti_backup_')) return
    try {
        const pages = browser?.contexts()?.flatMap(context => context.pages()) || []
        const page = pages[pages.length - 1]
        if (page) {
            await mkdir(dirname(failureScreenshotPath), { recursive: true })
            await page.screenshot({ path: failureScreenshotPath, fullPage: true }).catch(() => {})
        }
    } catch {
        // Failure evidence is best-effort and must not mask the original result.
    }
}

if (process.argv.includes('--self-test')) {
    runSelfTest()
} else {
    await runMonitor()
}
