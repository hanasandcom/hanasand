import { publicMonitoringRequest } from '#utils/publicMonitoringRequest.ts'
import { extractBrowserPageContent } from '../browserTaskAnalysis.ts'
import { reviewDesignQuality } from '../verificationJobAnalysis.ts'
import { captureRenderedScreenshots } from './screenshots.ts'
import { captureRenderedJourneyProof } from './journey.ts'
import { completeJobWithArtifact, recordVerificationUsage, createArtifact } from './artifacts.ts'
import { getJob, updateStep } from './store.ts'
import type { VerificationJobRow } from './model.ts'

type FetchedVerificationTarget = {
    url: string
    response: {
        ok: boolean
        status: number
        statusText: string
        url: string
    }
    text: string
    startedAtMs: number
}

async function fetchVerificationTarget(job: VerificationJobRow, {
    fetchingStep,
    processingStep,
    userAgent,
    signal,
}: {
    fetchingStep: string
    processingStep: string
    userAgent: string
    signal: AbortSignal
}): Promise<FetchedVerificationTarget | null> {
    if (!job.target_url) {
        throw new Error('Missing target URL.')
    }
    const url = job.target_url
    const current = await getJob(job.id)
    if (current?.status === 'cancelled' || signal.aborted) {
        return null
    }
    await updateStep(job.id, fetchingStep)
    const startedAtMs = performance.now()
    const metadata = job.metadata || {}
    const timeoutMs = Math.max(1000, Math.min(Number(metadata.timeoutMs || 16000), 30000))
    const response = await publicMonitoringRequest(url, {
        headers: {
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
        },
        userAgent,
        followRedirects: true,
        readBody: true,
        timeoutMs,
        signal,
    })
    if (signal.aborted) return null
    await updateStep(job.id, processingStep)
    return { url, response, text: response.body, startedAtMs }
}

async function completeProofJob(job: VerificationJobRow, {
    status,
    currentStep,
    artifact,
    error,
    estimatedCostNok,
    metadata,
}: {
    status: 'completed' | 'failed'
    currentStep: string
    artifact: Record<string, unknown>
    error: string | null
    estimatedCostNok: number
    metadata: Record<string, unknown>
}) {
    const saved = await completeJobWithArtifact(job, { status, currentStep, artifact, error })
    if (!saved) return

    const billable = status === 'completed'
    await recordVerificationUsage(job, {
        kind: 'browser_proof_completed',
        units: 1,
        billableUnits: billable ? 1 : 0,
        estimatedCostNok: billable ? estimatedCostNok : 0,
        outcome: billable ? 'verified' : 'failed',
        metadata,
    })
}

export async function runBrowserJob(job: VerificationJobRow, signal: AbortSignal) {
    const target = await fetchVerificationTarget(job, {
        fetchingStep: 'Fetching browser target',
        processingStep: 'Extracting evidence',
        userAgent: 'HanasandAI-VerificationJob/1.0',
        signal,
    })
    if (!target) return
    const { url, response, text, startedAtMs } = target
    const metadata = job.metadata || {}
    const screenshots = metadata.captureScreenshot
        ? await captureRenderedScreenshots(url, job.id, signal)
        : []
    const journeyProof = await captureRenderedJourneyProof(url, job.id, signal)
    const pageContent = extractBrowserPageContent(text)
    const artifact = createArtifact('browser_result', 'Browser evidence', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        elapsed_ms: Math.round(performance.now() - startedAtMs),
        url: response.url || url,
        ...pageContent,
        screenshotPath: screenshots[0]?.path || null,
        screenshots,
        journeyProof,
        consoleMessages: [
            'Fetched browser target and captured structured page evidence.',
            screenshots.length ? `${screenshots.length} rendered screenshot artifact${screenshots.length === 1 ? '' : 's'} captured.` : 'Rendered screenshot capture was not requested or did not complete.',
            journeyProof ? 'Rendered non-destructive journey script completed.' : 'Rendered journey script did not complete.',
        ],
        pageErrors: response.ok ? [] : [`HTTP ${response.status} ${response.statusText}`],
    })
    await completeProofJob(job, {
        status: response.ok ? 'completed' : 'failed',
        currentStep: response.ok ? 'Browser proof completed' : 'Browser proof failed',
        artifact,
        error: response.ok ? null : `HTTP ${response.status} ${response.statusText}`,
        estimatedCostNok: 0.04,
        metadata: {
            jobId: job.id,
            requestId: job.request_id,
            targetUrl: url,
            status: response.status,
            journeyProofAvailable: Boolean(journeyProof),
            elapsedMs: Math.round(performance.now() - startedAtMs),
        },
    })
}

export async function runDesignJob(job: VerificationJobRow, signal: AbortSignal) {
    const target = await fetchVerificationTarget(job, {
        fetchingStep: 'Fetching design target',
        processingStep: 'Scoring design quality',
        userAgent: 'HanasandAI-DesignQualityJob/1.0',
        signal,
    })
    if (!target) return
    const { url, response, text, startedAtMs } = target
    const pageContent = extractBrowserPageContent(text)
    const { structure, textExcerpt: excerpt } = pageContent
    const review = reviewDesignQuality(text, excerpt, structure)
    const screenshots = await captureRenderedScreenshots(url, job.id, signal)
    const journeyProof = await captureRenderedJourneyProof(url, job.id, signal)
    const hasRenderedProof = screenshots.length > 0
    const passed = response.ok && review.score >= 72 && review.criticalIssues.length === 0
    const artifact = createArtifact('design_quality_report', 'Design quality report', {
        ok: response.ok,
        passed,
        score: review.score,
        status: passed ? 'passed' : 'failed',
        elapsed_ms: Math.round(performance.now() - startedAtMs),
        url: response.url || url,
        title: pageContent.title,
        checks: review.checks,
        issues: review.issues,
        criticalIssues: review.criticalIssues,
        repeatedPatternCount: review.repeatedPatternCount,
        genericPhraseCount: review.genericPhraseCount,
        screenshotPath: screenshots[0]?.path || null,
        screenshots,
        journeyProof,
        notVerified: [
            hasRenderedProof ? null : 'Rendered screenshot capture did not complete.',
            'Automated screenshot diffing still needs a before/after baseline to compare against.',
            journeyProof ? null : 'Rendered journey script did not complete.',
        ].filter(Boolean),
    })
    await completeProofJob(job, {
        status: passed ? 'completed' : 'failed',
        currentStep: passed ? 'Design QA passed' : 'Design QA failed',
        artifact,
        error: passed ? null : `Design QA score ${review.score}: ${review.issues.slice(0, 2).join('; ') || 'review failed'}`,
        estimatedCostNok: 0.06,
        metadata: {
            proofType: 'design_quality',
            jobId: job.id,
            requestId: job.request_id,
            targetUrl: url,
            status: response.status,
            score: review.score,
            genericPhraseCount: review.genericPhraseCount,
            repeatedPatternCount: review.repeatedPatternCount,
            renderedScreenshotCount: screenshots.length,
            journeyProofAvailable: Boolean(journeyProof),
            elapsedMs: Math.round(performance.now() - startedAtMs),
        },
    })
}
