import type { DwmAlertGenerationReadinessInput } from '@/utils/productProgress/readiness'
import type { FetchResult } from './routeHelpers'
import { uniqueStrings, stringsFrom, stringOrUndefined } from './routeHelpers'

export function alertGenerationReadiness(input: {
    generatedAt: string
    route: string
    fetch: FetchResult
}): DwmAlertGenerationReadinessInput {
    const proof = dwmAlertGenerationProof(input.fetch)
    const counts = proof?.counts || {}
    const evidenceWindow = generationEvidenceWindowFromProof(proof)
    const evidenceWindowReady = Boolean(evidenceWindow.captureIds.length > 0 && evidenceWindow.lastObservedAt)
    const blockerCodes = Array.isArray(proof?.blockerCodes) ? proof.blockerCodes.filter(Boolean).map(String) : []
    const blockers = [
        input.fetch.ok ? '' : input.fetch.error || `DWM alert-generation route returned HTTP ${input.fetch.status}.`,
        proof ? '' : 'DWM alert-generation route did not return dwm.alert_generation_readiness.v1.',
        proof?.readyForCustomerDelivery ? '' : 'DWM alert generation is not ready for customer delivery.',
        evidenceWindowReady ? '' : 'DWM alert generation did not include a generation evidence window with capture timestamps.',
        ...(Array.isArray(proof?.blockers) ? proof.blockers.filter(Boolean).map(String) : []),
    ].filter(Boolean)

    return {
        schemaVersion: proof?.schemaVersion || 'dwm.alert_generation_readiness.v1',
        status: blockers.length ? 'needs_action' : 'ready',
        readyForCustomerDelivery: proof?.readyForCustomerDelivery === true,
        candidateCount: numberOrUndefined(counts.candidateCount),
        captureRefCount: numberOrUndefined(counts.captureRefCount),
        matchedCandidateCount: numberOrUndefined(counts.matchedCandidateCount),
        missingRouteCandidateCount: numberOrUndefined(proof?.webhookReadiness?.missingRouteCandidateCount ?? counts.missingRouteCandidateCount),
        generationEvidenceWindowReady: evidenceWindowReady,
        generationEvidenceWindowCaptureCount: evidenceWindow.captureIds.length,
        generationEvidenceWindowSourceFamilies: evidenceWindow.sourceFamilies,
        latestEvidenceAt: evidenceWindow.lastObservedAt,
        blockerCodes,
        blockers,
        source: input.route,
        checkedAt: input.generatedAt,
        proofTimestamp: evidenceWindow.lastObservedAt || proof?.generatedAt || input.generatedAt,
    }
}

type DwmAlertGenerationProof = {
    schemaVersion: 'dwm.alert_generation_readiness.v1'
    generatedAt?: string
    readyForCustomerDelivery?: boolean
    counts?: {
        candidateCount?: number
        captureRefCount?: number
        matchedCandidateCount?: number
        missingRouteCandidateCount?: number
    }
    webhookReadiness?: {
        missingRouteCandidateCount?: number
    }
    generationEvidenceWindow?: GenerationEvidenceWindow
    plan?: {
        candidates?: Array<{
            evidenceWindow?: GenerationEvidenceWindow
        }>
    }
    blockerCodes?: string[]
    blockers?: string[]
}

type GenerationEvidenceWindow = {
    captureIds?: string[]
    sourceFamilies?: string[]
    contentHashes?: string[]
    firstObservedAt?: string
    lastObservedAt?: string
}

type NormalizedGenerationEvidenceWindow = {
    captureIds: string[]
    sourceFamilies: string[]
    contentHashes: string[]
    firstObservedAt?: string
    lastObservedAt?: string
}

function dwmAlertGenerationProof(result: FetchResult): DwmAlertGenerationProof | undefined {
    const payload = result.json as {
        readiness?: unknown
        alertGenerationReadiness?: unknown
    } | DwmAlertGenerationProof | undefined
    const proof = isDwmAlertGenerationProof(payload)
        ? payload
        : isDwmAlertGenerationProof(payload?.readiness)
            ? payload.readiness
            : isDwmAlertGenerationProof(payload?.alertGenerationReadiness)
                ? payload.alertGenerationReadiness
                : undefined
    return proof
}

function isDwmAlertGenerationProof(input: unknown): input is DwmAlertGenerationProof {
    if (!input || typeof input !== 'object') return false
    return (input as { schemaVersion?: unknown }).schemaVersion === 'dwm.alert_generation_readiness.v1'
}

function generationEvidenceWindowFromProof(proof?: DwmAlertGenerationProof): NormalizedGenerationEvidenceWindow {
    const windows = [
        proof?.generationEvidenceWindow,
        ...(Array.isArray(proof?.plan?.candidates)
            ? proof.plan.candidates.map(candidate => candidate.evidenceWindow)
            : []),
    ].filter(isGenerationEvidenceWindow)

    return windows.reduce<NormalizedGenerationEvidenceWindow>((acc, window) => ({
        captureIds: uniqueStrings([...acc.captureIds, ...stringsFrom(window.captureIds)]),
        sourceFamilies: uniqueStrings([...acc.sourceFamilies, ...stringsFrom(window.sourceFamilies)]),
        contentHashes: uniqueStrings([...acc.contentHashes, ...stringsFrom(window.contentHashes)]),
        firstObservedAt: earlierIso(acc.firstObservedAt, stringOrUndefined(window.firstObservedAt)),
        lastObservedAt: laterIso(acc.lastObservedAt, stringOrUndefined(window.lastObservedAt)),
    }), {
        captureIds: [] as string[],
        sourceFamilies: [] as string[],
        contentHashes: [] as string[],
        firstObservedAt: undefined as string | undefined,
        lastObservedAt: undefined as string | undefined,
    })
}

function isGenerationEvidenceWindow(input: unknown): input is GenerationEvidenceWindow {
    if (!input || typeof input !== 'object') return false
    const window = input as GenerationEvidenceWindow
    return Array.isArray(window.captureIds) || Array.isArray(window.sourceFamilies) || Boolean(window.firstObservedAt || window.lastObservedAt)
}

function earlierIso(left?: string, right?: string) {
    if (!left) return right
    if (!right) return left
    return Date.parse(right) < Date.parse(left) ? right : left
}

function laterIso(left?: string, right?: string) {
    if (!left) return right
    if (!right) return left
    return Date.parse(right) > Date.parse(left) ? right : left
}

function numberOrUndefined(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

