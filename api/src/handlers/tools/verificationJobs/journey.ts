import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createCdpClient, waitForPageReady, withAbort, abortReason } from './cdp.ts'

const CHROMIUM_BIN = process.env.CHROMIUM_BIN || 'chromium-browser'

export async function captureRenderedJourneyProof(url: string, jobId: string, signal: AbortSignal) {
    if (process.env.NODE_ENV === 'production') return null
    signal.throwIfAborted()
    const dir = await mkdtemp(path.join(tmpdir(), 'hanasand-ai-journey-'))
    let child: ReturnType<typeof spawn> | null = null
    try {
        const browser = await startDebugChromium(dir, signal)
        child = browser.child
        const page = await openDebugPage(browser.port, url, signal)
        if (!page?.webSocketDebuggerUrl) {
            return null
        }
        const client = await withAbort(createCdpClient(page.webSocketDebuggerUrl), signal)
        try {
            await withAbort(client.send('Page.enable'), signal)
            await withAbort(client.send('Runtime.enable'), signal)
            await waitForPageReady(client, url, signal)
            const evaluation = await withAbort(client.send('Runtime.evaluate', {
                expression: `(${nonDestructiveJourneyScript.toString()})()`,
                awaitPromise: true,
                returnByValue: true,
            }), signal)
            const value = ((evaluation.result || {}) as { value?: unknown }).value
            if (!value || typeof value !== 'object') {
                return null
            }
            return {
                jobId,
                mode: 'non_destructive_rendered_script',
                targetUrl: url,
                capturedAt: new Date().toISOString(),
                ...value,
            }
        } finally {
            client.close()
        }
    } catch {
        if (signal.aborted) throw abortReason(signal)
        return null
    } finally {
        if (child) {
            child.kill('SIGKILL')
        }
        await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
}

async function startDebugChromium(userDataDir: string, signal: AbortSignal) {
    signal.throwIfAborted()
    const child = spawn(CHROMIUM_BIN, [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--remote-debugging-port=0',
        `--user-data-dir=${userDataDir}`,
        'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    let endpoint: { port: number }
    try {
        endpoint = await new Promise<{ port: number }>((resolve, reject) => {
            let settled = false
            const finish = (error?: Error, port?: number) => {
                if (settled) return
                settled = true
                clearTimeout(timeout)
                signal.removeEventListener('abort', onAbort)
                if (error) reject(error)
                else resolve({ port: port! })
            }
            const onAbort = () => finish(abortReason(signal))
            const timeout = setTimeout(() => finish(new Error('Chromium debug startup timed out.')), 9000)
            child.stderr.on('data', (chunk) => {
                stderr += String(chunk)
                const match = stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//)
                if (match?.[1]) {
                    finish(undefined, Number(match[1]))
                }
            })
            child.on('error', (error) => {
                finish(error)
            })
            child.on('exit', (code) => {
                finish(new Error(`Chromium debug process exited early with ${code}.`))
            })
            signal.addEventListener('abort', onAbort, { once: true })
            if (signal.aborted) onAbort()
        })
    } catch (error) {
        child.kill('SIGKILL')
        throw error
    }
    return { child, port: endpoint.port }
}

async function openDebugPage(port: number, url: string, signal: AbortSignal) {
    const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT', signal })
    if (!response.ok) {
        return null
    }
    return await response.json() as { webSocketDebuggerUrl?: string }
}

function nonDestructiveJourneyScript() {
    const text = (document.body?.innerText || '').toLowerCase()
    const controls = [...document.querySelectorAll('input, textarea, select')] as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[]
    const fillable = controls.filter((control) => {
        const input = control as HTMLInputElement
        const type = (input.type || '').toLowerCase()
        return !control.disabled && !control.hasAttribute('readonly') && !['hidden', 'submit', 'button', 'reset', 'file', 'checkbox', 'radio'].includes(type)
    })
    let focused = 0
    let filled = 0
    const blocked: string[] = []
    for (const control of fillable.slice(0, 12)) {
        try {
            control.focus()
            focused += document.activeElement === control ? 1 : 0
            if (control instanceof HTMLSelectElement) {
                if (control.options.length > 1) {
                    control.selectedIndex = 1
                    filled += 1
                }
            } else {
                const type = control instanceof HTMLInputElement ? (control.type || '').toLowerCase() : 'text'
                control.value = type === 'email' ? 'proof@example.com' : type === 'tel' ? '+4700000000' : type === 'number' ? '1' : 'Validation input'
                control.dispatchEvent(new Event('input', { bubbles: true }))
                control.dispatchEvent(new Event('change', { bubbles: true }))
                filled += 1
            }
        } catch {
            blocked.push((control.getAttribute('name') || control.getAttribute('aria-label') || control.id || control.tagName).slice(0, 80))
        }
    }
    const buttons = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], a[href]')] as HTMLElement[]
    const buttonLabels = buttons.map((button) => (button.innerText || button.getAttribute('aria-label') || button.getAttribute('value') || button.getAttribute('href') || '').trim()).filter(Boolean).slice(0, 20)
    const forms = [...document.querySelectorAll('form')]
    const submitControls = [...document.querySelectorAll('button[type="submit"], input[type="submit"], form button:not([type]), form button[type=""]')]
    const journeyTypes = {
        auth: /\b(sign in|login|log in|register|account|password)\b/.test(text),
        checkout: /\b(checkout|cart|payment|invoice|subscription|billing)\b/.test(text),
        booking: /\b(book|booking|appointment|schedule|reservation)\b/.test(text),
        contact: /\b(contact|message|email|phone|request)\b/.test(text) || forms.length > 0,
        dashboardCrud: /\b(create|edit|delete|save|dashboard|table|filter|export)\b/.test(text),
    }
    return {
        url: location.href,
        title: document.title || null,
        forms: forms.length,
        controls: controls.length,
        fillableControls: fillable.length,
        focusedControls: focused,
        filledControls: filled,
        submitControls: submitControls.length,
        buttonLabels,
        blockedControls: blocked,
        journeyTypes,
        readiness: {
            hasVisibleAction: buttonLabels.length > 0,
            formsCanBeDryFilled: fillable.length === 0 || filled > 0,
            submitWithoutMutationAvoided: true,
            detectedCriticalJourney: Object.values(journeyTypes).some(Boolean),
        },
    }
}
