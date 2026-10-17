import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { abortReason } from './cdp.ts'

const CHROMIUM_BIN = process.env.CHROMIUM_BIN || 'chromium-browser'

type ScreenshotViewport = {
    label: string
    width: number
    height: number
}

export async function captureRenderedScreenshots(url: string, jobId: string, signal: AbortSignal) {
    if (process.env.NODE_ENV === 'production') return []
    const viewports: ScreenshotViewport[] = [
        { label: 'mobile', width: 390, height: 844 },
        { label: 'desktop', width: 1440, height: 1000 },
    ]
    const results = []
    for (const viewport of viewports) {
        signal.throwIfAborted()
        const result = await captureRenderedScreenshot(url, jobId, viewport, signal)
        if (result) {
            results.push(result)
        }
    }
    return results
}

async function captureRenderedScreenshot(url: string, jobId: string, viewport: ScreenshotViewport, signal: AbortSignal) {
    signal.throwIfAborted()
    const dir = await mkdtemp(path.join(tmpdir(), 'hanasand-ai-proof-'))
    const screenshotPath = path.join(dir, `${jobId}-${viewport.label}.png`)
    try {
        await runChromium([
            '--headless=new',
            '--no-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            `--window-size=${viewport.width},${viewport.height}`,
            `--screenshot=${screenshotPath}`,
            url,
        ], 18000, signal)
        signal.throwIfAborted()
        const bytes = await readFile(screenshotPath)
        return {
            viewport: viewport.label,
            width: viewport.width,
            height: viewport.height,
            path: `artifact://${jobId}/${viewport.label}.png`,
            mimeType: 'image/png',
            sizeBytes: bytes.length,
            dataUrl: `data:image/png;base64,${bytes.toString('base64')}`,
        }
    } catch {
        if (signal.aborted) throw abortReason(signal)
        return null
    } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {})
    }
}

async function runChromium(args: string[], timeoutMs: number, signal: AbortSignal) {
    signal.throwIfAborted()
    await new Promise<void>((resolve, reject) => {
        const child = spawn(CHROMIUM_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
        let stderr = ''
        let settled = false
        const finish = (error?: Error) => {
            if (settled) return
            settled = true
            clearTimeout(timeout)
            signal.removeEventListener('abort', onAbort)
            if (error) reject(error)
            else resolve()
        }
        const stop = (error: Error) => {
            child.kill('SIGKILL')
            finish(error)
        }
        const onAbort = () => stop(abortReason(signal))
        const timeout = setTimeout(() => stop(new Error('Chromium screenshot timed out.')), timeoutMs)
        child.stderr.on('data', (chunk) => {
            stderr += String(chunk).slice(0, 4000)
        })
        child.on('error', (error) => finish(error))
        child.on('close', (code) => {
            if (code === 0) {
                finish()
            } else {
                finish(new Error(stderr || `Chromium exited with ${code}.`))
            }
        })
        signal.addEventListener('abort', onAbort, { once: true })
        if (signal.aborted) onAbort()
    })
}

