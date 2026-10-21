import { existsSync, writeFileSync } from 'node:fs'
import type { FastifyInstance } from 'fastify'
import { SingleUseBrowser } from '../../utils/ws/singleUseBrowser.ts'
import { chromium, type Browser } from 'playwright'
import { fullscreenBrowserPage } from './networkEvidence.ts'

export const DEFAULT_WIDTH = 1280
export const DEFAULT_HEIGHT = 720
export const MAX_DURATION_MS = 60 * 60 * 1000
export const DEFAULT_DURATION_MS = 90 * 1000
export const SUSPICIOUS_DURATION_MS = 3 * 60 * 1000
export const MANUAL_EXTENSION_MS = 5 * 60 * 1000
let warmRegularBrowser: Promise<Browser> | null = null
export const prestartedBrowser = new SingleUseBrowser<Browser>()
const warmClaimFile = '/tmp/hanasand-browser-claimed'

export function registerPrestartedBrowser(fastify: FastifyInstance) {
    const token = process.env.BROWSER_SANDBOX_POOL_TOKEN
    if (!token || process.env.BROWSER_SANDBOX_WORKER_ONLY !== '1') return
    // Never make a used browser available again after an API process restart.
    if (existsSync(warmClaimFile)) prestartedBrowser.state = 'retired'
    else fastify.addHook('onReady', async () => {
        const deadline = setTimeout(() => { prestartedBrowser.state = 'retired' }, 60_000)
        deadline.unref()
        void (async () => {
            assertProductionBrowserWorker()
            const browser = await chromium.launch(chromiumLaunchOptions())
            const probe = await browser.newContext()
            const blank = await probe.newPage()
            await fullscreenBrowserPage(probe, blank)
            await blank.goto('about:blank')
            await blank.bringToFront()
            // X11/Chromium can be connected before the first composited frame.
            // Keep that initialization inside the pool, not the user's request.
            let rendered = false
            for (let attempt = 0; attempt < 20; attempt++) {
                rendered = await blank.screenshot({ timeout: 2000 }).then(() => true).catch(() => false)
                if (rendered) break
                await new Promise(resolve => setTimeout(resolve, 250))
            }
            if (!rendered) { await browser.close(); throw new Error('Prestarted browser did not render a frame.') }
            await probe.close()
            if (prestartedBrowser.state !== 'starting') { await browser.close(); return }
            browser.on('disconnected', () => { prestartedBrowser.state = 'retired' })
            prestartedBrowser.ready(browser)
        })().catch(error => {
            prestartedBrowser.state = 'retired'
            fastify.log.error(error, 'Browser prestart failed')
        }).finally(() => clearTimeout(deadline))
    })
    fastify.route<{ Body: { sessionId?: string; retire?: boolean } }>({
        method: ['GET', 'POST'], url: '/internal/browser-warm',
        handler: async (req, reply) => {
            if (req.headers['x-browser-pool-token'] !== token) return reply.code(403).send({ error: 'Forbidden' })
            if (req.method === 'POST') {
                if (req.body?.retire) {
                    if (!prestartedBrowser.retire()) return reply.code(409).send({ error: 'Already claimed' })
                } else {
                    const sessionId = req.body?.sessionId
                    if (!sessionId || !/^[a-zA-Z0-9_.-]{1,128}$/.test(sessionId)) return reply.code(400).send({ error: 'Invalid session' })
                    if (prestartedBrowser.state === 'ready') writeFileSync(warmClaimFile, sessionId, { flag: 'wx', mode: 0o600 })
                    if (!prestartedBrowser.claim(sessionId)) return reply.code(409).send({ error: 'Unavailable' })
                }
            }
            return { state: prestartedBrowser.state, sessionId: prestartedBrowser.sessionId }
        },
    })
}

export function allowLocalSandboxTargets() {
    return process.env.NODE_ENV !== 'production' && process.env.BROWSER_SANDBOX_ALLOW_LOCAL_TARGETS === '1'
}

function chromiumHeadless() {
    if (process.env.BROWSER_SANDBOX_HEADLESS) return process.env.BROWSER_SANDBOX_HEADLESS !== '0'
    return process.platform === 'linux' && !process.env.DISPLAY
}

export function chromiumLaunchOptions(proxy?: string, headless = chromiumHeadless()) {
    const args = [
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        ...(headless ? [] : ['--kiosk', '--window-position=0,0', `--window-size=${DEFAULT_WIDTH},${DEFAULT_HEIGHT}`]),
    ]
    if (process.env.BROWSER_SANDBOX_CHROMIUM_SANDBOX !== '1') args.unshift('--no-sandbox')
    return {
        headless,
        executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium',
        chromiumSandbox: process.env.BROWSER_SANDBOX_CHROMIUM_SANDBOX === '1',
        proxy: proxy ? { server: proxy } : undefined,
        args,
    }
}

export function providerChromiumLaunchOptions(display = process.env.BROWSER_SANDBOX_PROVIDER_DISPLAY) {
    const options = chromiumLaunchOptions(undefined, !display)
    return display ? { ...options, env: { ...process.env, DISPLAY: display } } : options
}

export function regularBrowser() {
    warmRegularBrowser ||= chromium.launch(chromiumLaunchOptions()).then(browser => {
        browser.on('disconnected', () => {
            warmRegularBrowser = null
        })
        return browser
    }).catch(error => {
        warmRegularBrowser = null
        throw error
    })
    return warmRegularBrowser
}

export function assertProductionBrowserWorker() {
    if (process.env.NODE_ENV !== 'production') return
    if (process.env.BROWSER_SANDBOX_WORKER_ONLY !== '1') throw new Error('Production browser sessions must run in isolated browser workers.')
    if (process.env.BROWSER_SANDBOX_CHROMIUM_SANDBOX !== '1') throw new Error('Production browser workers require Chromium sandbox.')
}

if (process.env.NODE_ENV !== 'production' && process.env.BROWSER_SANDBOX_PREWARM !== '0') {
    setTimeout(() => void regularBrowser().catch(() => undefined), 1000).unref()
}
