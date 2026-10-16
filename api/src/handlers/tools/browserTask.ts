import type { FastifyReply, FastifyRequest } from 'fastify'
import tokenWrapper from '#utils/auth/tokenWrapper.ts'
import { analyzeBrowserPage, emptyBrowserPageAnalysis } from './browserTaskAnalysis.ts'
import { applyAgentActionPolicy } from './agentActionPolicy.ts'

export default async function browserTaskTool(req: FastifyRequest, res: FastifyReply) {
    res.header('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate')
    res.header('Vary', 'Authorization, Cookie')

    const { valid, id: actorId } = await tokenWrapper(req, res)
    if (!valid) {
        return res.status(401).send({ error: 'Unauthorized.' })
    }

    const { url, timeoutMs = 12000 } = req.body as {
        url?: string
        timeoutMs?: number
        captureScreenshot?: boolean
    } ?? {}

    if (!url) {
        return res.status(400).send({ error: 'Missing url.' })
    }

    let target: URL
    try {
        target = new URL(url)
    } catch {
        return res.status(400).send({ error: 'Invalid url.' })
    }

    if (!['http:', 'https:'].includes(target.protocol)) {
        return res.status(400).send({ error: 'Only http and https browser tasks are supported.' })
    }

    const policyResponse = await applyAgentActionPolicy(req, res, {
        action: 'browser_task',
        actorId,
        method: 'GET',
        target: target.toString(),
        metadata: { host: target.hostname },
    })
    if (policyResponse) return policyResponse

    const started = performance.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, Math.min(timeoutMs, 30000)))

    try {
        const response = await fetch(target, {
            headers: {
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
                'User-Agent': 'HanasandAI-BrowserTask/1.0',
            },
            signal: controller.signal,
        })
        const text = await response.text()
        const pageAnalysis = analyzeBrowserPage(text, response.url || target.toString())
        const warnings = [
            'Fetched browser target without executing client-side JavaScript.',
            'Screenshot capture is not available in this lightweight server task yet.',
            'Build, JavaScript interactions, auth, checkout, booking, and dashboard CRUD need a full runner before they can be marked verified.',
        ]

        return res.status(response.ok ? 200 : 502).send({
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            elapsed_ms: Math.round(performance.now() - started),
            url: response.url || target.toString(),
            ...pageAnalysis,
            screenshotPath: null,
            consoleMessages: warnings,
            pageErrors: response.ok ? [] : [`HTTP ${response.status} ${response.statusText}`],
        })
    } catch (error) {
        return res.status(502).send({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            elapsed_ms: Math.round(performance.now() - started),
            url: target.toString(),
            ...emptyBrowserPageAnalysis(),
            screenshotPath: null,
            consoleMessages: ['Fetched browser target without executing client-side JavaScript.'],
            pageErrors: [error instanceof Error ? error.message : String(error)],
        })
    } finally {
        clearTimeout(timeout)
    }
}
