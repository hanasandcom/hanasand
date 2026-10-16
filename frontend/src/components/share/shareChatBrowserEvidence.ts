import randomId from '@/utils/random/randomId'
import { aiClientRequest } from '@/utils/ai/client'
import { friendlyChatError, wait } from './shareChatApi'
import { emptyBrowserStructure } from './shareChatPresentation'
import type { BrowserEvidence, BrowserJourneyProof, BrowserQuality, ToolCall, VerificationJobResponse } from './shareChatTypes'

export async function runBrowserEvidenceTool(call: ToolCall): Promise<BrowserEvidence | null> {
    if (!call.url) {
        return null
    }
    try {
        const job = await runDurableVerificationJob(call, 'browser')
        if (!job) {
            return runLegacyBrowserEvidenceTool(call)
        }
        const browserArtifact = job.artifacts?.find((artifact) => artifact.type === 'browser_result')
        if (!browserArtifact?.data) {
            const legacyEvidence = await runLegacyBrowserEvidenceTool(call)
            if (legacyEvidence) {
                return legacyEvidence
            }
        }
        const data = browserArtifact?.data || {}
        const evidence = browserEvidenceFromVerificationJob(call.url, job, data)
        return evidence
    } catch {
        return {
            id: randomId(),
            url: call.url,
            title: null,
            screenshotPath: null,
            structure: emptyBrowserStructure(),
            consoleMessages: [],
            pageErrors: ['Browser evidence is reconnecting. Try the check again in a moment.'],
            fetchedAt: new Date().toISOString(),
        }
    }
}

async function runDurableVerificationJob(call: ToolCall, kind: 'browser'): Promise<NonNullable<VerificationJobResponse['job']> | null> {
    const response = await aiClientRequest('/tools/verification-jobs', {
        method: 'POST',
        body: JSON.stringify({
            kind,
            targetUrl: call.url,
            priority: 'paid',
            captureScreenshot: Boolean(call.captureScreenshot),
            timeoutMs: call.timeoutMs || 16000,
            maxRetries: 1,
            metadata: {
                source: 'share_chat',
                requestedScreenshot: Boolean(call.captureScreenshot),
            },
        }),
    })
    const created = await response.json().catch(() => null) as VerificationJobResponse | null
    if (!response.ok || !created?.job?.id) {
        return null
    }

    let job = created.job
    for (let index = 0; index < 36; index += 1) {
        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
            return job
        }
        await wait(750)
        const check = await aiClientRequest(`/tools/verification-jobs/${job.id}`)
        const payload = await check.json().catch(() => null) as VerificationJobResponse | null
        if (!check.ok || !payload?.job) {
            return job
        }
        job = payload.job
    }
    return job
}

function browserEvidenceFromVerificationJob(url: string, job: NonNullable<VerificationJobResponse['job']>, data: Record<string, unknown>): BrowserEvidence {
    const structure = typeof data.structure === 'object' && data.structure ? data.structure as BrowserEvidence['structure'] : emptyBrowserStructure()
    const consoleMessages = Array.isArray(data.consoleMessages) ? data.consoleMessages.filter((item): item is string => typeof item === 'string') : []
    const pageErrors = Array.isArray(data.pageErrors) ? data.pageErrors.filter((item): item is string => typeof item === 'string') : []
    const journeyProof = typeof data.journeyProof === 'object' && data.journeyProof ? data.journeyProof as BrowserJourneyProof : undefined
    const jobError = job.status === 'failed' && job.error ? [job.error] : []
    return {
        id: randomId(),
        url: typeof data.url === 'string' ? data.url : url,
        title: typeof data.title === 'string' ? data.title : null,
        screenshotPath: typeof data.screenshotPath === 'string' ? data.screenshotPath : null,
        textExcerpt: typeof data.textExcerpt === 'string' ? data.textExcerpt : '',
        structure,
        consoleMessages: [
            `Durable verification job ${job.id}: ${job.currentStep || job.status}.`,
            ...consoleMessages,
        ],
        pageErrors: [...jobError, ...pageErrors],
        quality: typeof data.quality === 'object' && data.quality ? data.quality as BrowserQuality : undefined,
        journeyProof,
        fetchedAt: new Date().toISOString(),
    }
}

async function runLegacyBrowserEvidenceTool(call: ToolCall): Promise<BrowserEvidence | null> {
    if (!call.url) {
        return null
    }
    try {
        const requestBody = JSON.stringify({
            url: call.url,
            captureScreenshot: Boolean(call.captureScreenshot),
            timeoutMs: call.timeoutMs || 16000,
        })
        let response = await aiClientRequest('/tools/browser/task', {
            method: 'POST',
            body: requestBody,
        })
        let payload = await response.json().catch(() => null) as Omit<BrowserEvidence, 'id' | 'fetchedAt'> | null
        if (!response.ok || !payload) {
            const directResponse = await fetch('/api/tools/browser/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: requestBody,
            }).catch(() => null)
            if (directResponse?.ok) {
                response = directResponse
                payload = await response.json().catch(() => null) as Omit<BrowserEvidence, 'id' | 'fetchedAt'> | null
            }
        }
        if (!response.ok || !payload) {
            return {
                id: randomId(),
                url: call.url,
                title: null,
                screenshotPath: null,
                structure: emptyBrowserStructure(),
                consoleMessages: [],
                pageErrors: [friendlyChatError(response.status)],
                fetchedAt: new Date().toISOString(),
            }
        }
        return {
            id: randomId(),
            ...payload,
            url: payload.url || call.url,
            structure: payload.structure || emptyBrowserStructure(),
            fetchedAt: new Date().toISOString(),
        }
    } catch {
        return {
            id: randomId(),
            url: call.url,
            title: null,
            screenshotPath: null,
            structure: emptyBrowserStructure(),
            consoleMessages: [],
            pageErrors: ['Browser evidence is reconnecting. Try the check again in a moment.'],
            fetchedAt: new Date().toISOString(),
        }
    }
}
