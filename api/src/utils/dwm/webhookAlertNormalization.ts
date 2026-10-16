import crypto from 'node:crypto'
import { clean, cleanList, firstClean, recordOrEmpty } from './webhookValueUtils.ts'
import { parseCount, truncate } from './webhookDeliveryUtilities.ts'

export function normalizeAlert(alert: Record<string, unknown>) {
    const webhookContext = recordOrEmpty(alert.webhookContext)
    const workflowContext = recordOrEmpty(alert.workflowContext)
    const matchedTerm = normalizeMatchedTerm(alert.matchedTerm)
    const company = clean(alert.company) || clean(alert.organizationName) || clean(alert.orgName)
    const domain = clean(alert.domain) || (matchedTerm.kind === 'domain' ? matchedTerm.value : '')
    const id = clean(alert.id) || `dwm-alert-${crypto.randomUUID()}`
    const title = clean(alert.title)
        || (company && matchedTerm.value ? `${company} matched ${matchedTerm.value}` : '')
        || 'Dark web monitoring alert'
    const severity = parseSeverity(alert.severity)
    const evidence = normalizeEvidence(alert.evidence)
    const evidenceCount = parseCount(alert.evidenceCount)
    const route = clean(alert.route)
        || clean(alert.recommendedRoute)
        || clean((alert.webhookDelivery as Record<string, unknown> | undefined)?.recommendedRoute)
        || 'customer_webhook'
    const casePath = clean(alert.casePath)
        || clean(alert.caseUrl)
        || clean(alert.path)
        || (id === 'webhook_test' ? '/dwm' : `/dwm?alert=${encodeURIComponent(id)}`)
    const alertUrl = clean(alert.alertUrl)
        || clean(alert.alertURL)
        || clean(alert.deepLink)
        || clean(alert.url)
        || clean(alert.caseUrl)
        || (casePath.startsWith('http://') || casePath.startsWith('https://') ? casePath : '')
    const caseActionId = firstClean(alert.caseActionId, alert.actionId, webhookContext.caseActionId, webhookContext.actionId, workflowContext.caseActionId, workflowContext.actionId)
    const caseActionPath = firstClean(alert.caseActionPath, alert.actionPath, alert.actionUrl, webhookContext.caseActionPath, webhookContext.actionPath, webhookContext.actionUrl, workflowContext.caseActionPath, workflowContext.actionPath, workflowContext.actionUrl)
    const provenance = alert.provenance || webhookContext.provenance || {
        captureIds: cleanList(webhookContext.captureIds).length ? cleanList(webhookContext.captureIds) : cleanList(workflowContext.captureIds),
        sourceIds: cleanList(webhookContext.sourceIds).length ? cleanList(webhookContext.sourceIds) : cleanList(workflowContext.sourceIds),
        primaryCaptureId: firstClean(webhookContext.primaryCaptureId, workflowContext.primaryCaptureId),
    }
    const confidence = normalizeConfidence(
        firstPresent(alert.confidence, alert.confidenceScore, webhookContext.confidence, webhookContext.confidenceScore, workflowContext.confidence, workflowContext.confidenceScore),
        firstClean(alert.confidenceReason, alert.confidenceRationale, alert.reasoning, webhookContext.confidenceReason, workflowContext.confidenceReason)
    )
    const eventTimestamp = firstClean(
        alert.eventTimestamp,
        alert.occurredAt,
        webhookContext.eventTimestamp,
        workflowContext.eventTimestamp,
        alert.replayedAt,
        alert.updatedAt,
        alert.firstSeenAt,
        alert.createdAt
    )
    const evidenceTimestamp = firstClean(
        alert.evidenceTimestamp,
        webhookContext.evidenceTimestamp,
        workflowContext.evidenceTimestamp,
        evidence.find(item => item.capturedAt)?.capturedAt,
        eventTimestamp
    )

    return {
        id,
        title,
        severity,
        tenantId: firstClean(alert.tenantId, webhookContext.tenantId, workflowContext.tenantId),
        company,
        domain,
        companyOrDomain: company || domain || matchedTerm.value,
        claimSummary: clean(alert.claimSummary) || clean(alert.summary) || 'A watched organization or asset matched newly collected threat intelligence.',
        recommendedAction: clean(alert.recommendedAction) || 'Review the evidence, validate the match, and contact the affected owner if exposure is confirmed.',
        matchedTerm,
        sourceFamily: firstClean(alert.sourceFamily, alert.source, webhookContext.sourceFamily, workflowContext.sourceFamily) || 'dark_web',
        artifactType: firstClean(alert.artifactType, alert.type, webhookContext.artifactType, workflowContext.artifactType) || 'mention',
        firstSeenAt: clean(alert.firstSeenAt) || clean(alert.createdAt) || eventTimestamp,
        eventTimestamp: eventTimestamp || clean(alert.firstSeenAt) || clean(alert.createdAt),
        evidenceTimestamp: evidenceTimestamp || eventTimestamp || clean(alert.firstSeenAt) || clean(alert.createdAt),
        savedAt: clean(alert.savedAt) || null,
        reviewState: clean(alert.reviewState) || 'needs_review',
        deliveryState: clean(alert.deliveryState) || 'pending_review',
        workflowState: {
            review: clean(alert.reviewState) || 'needs_review',
            delivery: clean(alert.deliveryState) || 'pending_review',
        },
        replayCount: parseCount(alert.replayCount ?? webhookContext.replayCount ?? workflowContext.replayCount),
        confidence,
        route,
        casePath,
        alertUrl,
        caseId: clean(alert.caseId) || clean(alert.caseIdCandidate) || clean(workflowContext.caseIdCandidate),
        caseActionId,
        caseActionPath,
        evidence,
        evidenceCount: evidence.length || evidenceCount,
        evidenceSummary: summarizeEvidence(evidence),
        dedupeKey: clean(alert.dedupeKey) || clean((alert.webhookDelivery as Record<string, unknown> | undefined)?.dedupeKey),
        provenance,
        provenanceSummary: provenanceSummary(provenance),
    }
}

export function normalizeMatchedTerm(value: unknown) {
    if (!value || typeof value !== 'object') {
        return { value: clean(value) || '', kind: 'unknown' }
    }
    const record = value as Record<string, unknown>
    return {
        value: clean(record.value) || clean(record.term) || '',
        kind: clean(record.kind) || 'unknown',
    }
}

export function normalizeWatchlist(value: unknown) {
    if (!value || typeof value !== 'object') {
        return { id: null, name: null, terms: [] as string[] }
    }
    const record = value as Record<string, unknown>
    const terms = Array.isArray(record.terms)
        ? record.terms.map(term => typeof term === 'string' ? term : clean((term as Record<string, unknown>)?.value)).filter(Boolean).slice(0, 20)
        : []

    return {
        id: clean(record.id) || null,
        name: clean(record.name) || null,
        terms,
    }
}

function normalizeEvidence(value: unknown) {
    if (!Array.isArray(value)) return []
    return value
        .slice(0, 6)
        .map(item => typeof item === 'object' && item
            ? {
                label: clean((item as Record<string, unknown>).label) || clean((item as Record<string, unknown>).title) || 'Evidence',
                detail: truncate(clean((item as Record<string, unknown>).detail) || clean((item as Record<string, unknown>).summary) || clean((item as Record<string, unknown>).excerpt), 500),
                source: clean((item as Record<string, unknown>).source) || clean((item as Record<string, unknown>).sourceName),
                capturedAt: clean((item as Record<string, unknown>).capturedAt)
                    || clean((item as Record<string, unknown>).observedAt)
                    || clean((item as Record<string, unknown>).firstSeenAt)
                    || clean((item as Record<string, unknown>).publishedAt)
                    || clean((item as Record<string, unknown>).at),
            }
            : { label: 'Evidence', detail: truncate(clean(item), 500), source: '', capturedAt: '' })
}

function summarizeEvidence(evidence: ReturnType<typeof normalizeEvidence>) {
    return truncate(evidence
        .slice(0, 3)
        .map((item, index) => {
            const prefix = item.label || `Evidence ${index + 1}`
            const detail = item.detail || item.source || item.capturedAt
            return detail ? `${prefix}: ${detail}` : prefix
        })
        .filter(Boolean)
        .join('\n'), 900)
}

export function provenanceSummary(value: unknown) {
    if (!value || typeof value !== 'object') return ''
    const record = value as Record<string, unknown>
    const captureIds = Array.isArray(record.captureIds) ? record.captureIds.map(clean).filter(Boolean).slice(0, 3) : []
    const sourceIds = Array.isArray(record.sourceIds) ? record.sourceIds.map(clean).filter(Boolean).slice(0, 3) : []
    const parts = [
        captureIds.length ? `captures: ${captureIds.join(', ')}` : '',
        sourceIds.length ? `sources: ${sourceIds.join(', ')}` : '',
        clean(record.primaryCaptureId) ? `primary: ${clean(record.primaryCaptureId)}` : '',
    ].filter(Boolean)
    return truncate(parts.join(' | '), 500)
}

function parseSeverity(value: unknown) {
    const severity = clean(value).toLowerCase()
    return ['critical', 'high', 'medium', 'low', 'info'].includes(severity) ? severity : 'medium'
}

function normalizeConfidence(value: unknown, reason: unknown) {
    const raw = typeof value === 'number'
        ? value
        : Number(String(clean(value)).replace('%', ''))
    const score = Number.isFinite(raw)
        ? Math.max(0, Math.min(100, Math.round(raw <= 1 ? raw * 100 : raw)))
        : null
    const label = score === null
        ? clean(value)
        : `${score}%`
    return {
        score,
        label,
        reason: truncate(clean(reason), 180),
    }
}

function firstPresent(...values: unknown[]) {
    for (const value of values) {
        if (value === null || value === undefined) continue
        if (typeof value === 'string' && !value.trim()) continue
        return value
    }
    return null
}
