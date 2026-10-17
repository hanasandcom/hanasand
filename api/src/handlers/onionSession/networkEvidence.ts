import { execFile } from 'node:child_process'
import { resolveTxt } from 'node:dns/promises'
import { promisify } from 'node:util'
import type { BrowserContext, Page, Request } from 'playwright'
import { inspectScript, isActionableObfuscatedScript, summarizeDeobfuscationTask } from './analysis.ts'
import { withTimeout } from './asyncOperations.ts'

type SandboxDeobfuscationTask = ReturnType<typeof summarizeDeobfuscationTask>

const asnCache = new Map<string, Promise<string | undefined>>()
const execFileAsync = promisify(execFile)

export async function fullscreenBrowserPage(context: BrowserContext, page: Page) {
    const session = await context.newCDPSession(page)
    try {
        const { windowId } = await session.send('Browser.getWindowForTarget')
        await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } })
    } finally {
        await session.detach().catch(() => undefined)
    }
}

export async function resizeBrowserDisplay({ width, height }: { width: number, height: number }) {
    await execFileAsync('selkies-gstreamer-resize', [`${width}x${height}`])
}

export function documentDeobfuscationTasks(html: string): SandboxDeobfuscationTask[] {
    const scripts = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
        .map((match, index) => inspectScript({
            src: /\bsrc=["']([^"']+)["']/i.exec(match[1])?.[1] || '',
            inline: match[2] || '',
        }, index))
        .filter(isActionableObfuscatedScript)
    return scripts.map(script => summarizeDeobfuscationTask(script))
}

export async function lookupAsn(ip: string | undefined) {
    if (!ip || !isPublicIPv4(ip)) return undefined
    if (!asnCache.has(ip)) {
        asnCache.set(ip, withTimeout(
            resolveTxt(`${ip.split('.').reverse().join('.')}.origin.asn.cymru.com`).then(parseCymruAsn).catch(() => undefined),
            700,
            undefined,
        ))
    }
    return asnCache.get(ip)
}

export function parseCymruAsn(records: string[][]) {
    const row = records.flat().find(Boolean)?.split('|').map(part => part.trim())
    return row?.[0] && /^\d+$/.test(row[0]) ? row[0] : undefined
}

function isPublicIPv4(ip: string) {
    const parts = ip.split('.').map(part => Number(part))
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false
    const [a, b] = parts
    return !(a === 10 || a === 127 || a === 0 || a >= 224 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254))
}

export function responseDurationMs(timing: { startTime: number; responseEnd: number }) {
    if (!Number.isFinite(timing.startTime) || !Number.isFinite(timing.responseEnd) || timing.responseEnd < 0) return undefined
    return Math.max(0, Math.round(timing.responseEnd))
}

export function elapsedMs(start?: string, end?: string) {
    const started = Date.parse(start || '')
    const ended = Date.parse(end || '')
    if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) return undefined
    return ended - started
}

export function requestInitiator(request: Request) {
    try {
        return request.frame()?.url() || 'browser'
    } catch {
        return 'browser'
    }
}
