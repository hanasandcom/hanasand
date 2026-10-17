import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { performance } from 'node:perf_hooks'
import { handleResult } from './login-ui-monitor-reporting.mjs'
import { evaluateLoginDashboard } from './login-ui-monitor-contract.mjs'

export { evaluateLoginDashboard }

const baseUrl = (process.env.HANASAND_BASE_URL || 'https://hanasand.com').replace(/\/$/, '')
const username = process.env.HANASAND_LOGIN_MONITOR_USER || ''
const password = process.env.HANASAND_LOGIN_MONITOR_PASSWORD || ''
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || ''
const statePath = process.env.HANASAND_LOGIN_MONITOR_STATE || '/home/hanasand/hanasand/ops/monitoring-state/login-ui-monitor.json'
const failureScreenshotPath = process.env.HANASAND_LOGIN_MONITOR_SCREENSHOT || '/home/hanasand/hanasand/ops/monitoring-state/login-ui-monitor-failure.png'
const timeoutMs = Number(process.env.HANASAND_LOGIN_MONITOR_TIMEOUT_MS || 25_000)
const repeatAlertMinutes = Number(process.env.HANASAND_LOGIN_MONITOR_REPEAT_ALERT_MINUTES || 15)
const now = new Date()
const reporting = { baseUrl, username, discordWebhookUrl, statePath, failureScreenshotPath, repeatAlertMinutes, now }

if (process.argv.includes('--self-test')) {
    runSelfTest()
    process.exit(0)
}

if (!username || !password) {
    await handleResult({
        ok: false,
        reason: 'missing_credentials',
        detail: 'HANASAND_LOGIN_MONITOR_USER and HANASAND_LOGIN_MONITOR_PASSWORD are required.',
        latencyMs: 0,
    }, reporting)
    process.exit(2)
}

const started = performance.now()
let browser

try {
    const { chromium } = await import('playwright')
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: false,
    })
    const page = await context.newPage()
    page.setDefaultTimeout(timeoutMs)

    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
    await page.getByRole('heading', { name: 'Hanasand' }).waitFor({ state: 'visible', timeout: timeoutMs })
    await page.getByLabel('Username', { exact: true }).fill(username)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await Promise.all([
        page.waitForURL(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: timeoutMs }),
        page.getByRole('button', { name: 'Log in' }).click(),
    ])

    await page.getByText('Operations Workbench', { exact: false }).waitFor({ state: 'visible', timeout: timeoutMs })
    const title = await page.title()
    const bodyText = await page.locator('body').innerText({ timeout: timeoutMs }).catch(() => '')
    const signal = evaluateLoginDashboard(title, bodyText)
    if (!signal.ok) throw new Error(signal.detail)

    await handleResult({
        ok: true,
        reason: 'login_ui_ok',
        detail: `Logged in as ${username} and reached /dashboard.`,
        latencyMs: Math.round(performance.now() - started),
    }, reporting)
} catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    try {
        const pages = browser?.contexts()?.flatMap(context => context.pages()) || []
        const page = pages[pages.length - 1]
        if (page) {
            await mkdir(dirname(failureScreenshotPath), { recursive: true })
            await page.screenshot({ path: failureScreenshotPath, fullPage: true }).catch(() => {})
        }
    } catch {
        // Best-effort failure evidence only.
    }

    await handleResult({
        ok: false,
        reason: 'login_ui_failed',
        detail,
        latencyMs: Math.round(performance.now() - started),
    }, reporting)
    process.exit(1)
} finally {
    await browser?.close().catch(() => {})
}

function runSelfTest() {
    const healthy = evaluateLoginDashboard('Operations Workbench | Hanasand', 'Operations Workbench\nDashboard')
    assert.equal(healthy.ok, true)

    const wrongTitle = evaluateLoginDashboard('Hanasand', 'Dashboard')
    assert.equal(wrongTitle.ok, false)

    const authFailure = evaluateLoginDashboard('Operations Workbench | Hanasand', 'Unauthorized')
    assert.equal(authFailure.ok, false)

    console.log('Login UI monitor self-test passed.')
}
