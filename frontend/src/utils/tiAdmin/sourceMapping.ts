import type { TiAdminAiReview, TiAdminCapture, TiAdminSource } from './types'
import type { ApiPayload } from './values'
import { hostname, isoValue, listValue, numberValue, objectValue, optionalIso, stringValue, textValue, unique } from './values'

export function toSource(record: ApiPayload, operations: ApiPayload | undefined, captures: TiAdminCapture[]): TiAdminSource | undefined {
    const id = stringValue(record.id)
    if (!id) return undefined
    const collection = objectValue(record.collection)
    const operatingMode = objectValue(record.operatingMode)
    const health = objectValue(operations?.health)
    const coverage = objectValue(operations?.coverage)
    const qualification = objectValue(operations?.qualification)
    const automaticReview = objectValue(objectValue(operations?.verification).automaticReview)
    const cadenceMinutes = Math.max(1, Math.round(numberValue(collection.cadenceSeconds, 3600) / 60))
    const monitoredSince = isoValue(collection.createdAt)
    const lastRunAt = isoValue(health.lastAttemptAt, health.lastSuccessAt)
    const scheduledTimes = [record.nextRunAt, objectValue(record.crawlState).backoffUntil, objectValue(record.crawlState).nextEligibleAt, operations?.nextRunAt, health.backoffUntil].map(value => Date.parse(String(value ?? ''))).filter(Number.isFinite)
    const nextRunAt = scheduledTimes.length ? new Date(Math.max(...scheduledTimes)).toISOString() : lastRunAt ? new Date(Date.parse(lastRunAt) + cadenceMinutes * 60_000).toISOString() : ''
    const sourceCaptures = captures.filter(capture => capture.sourceId === id)
    const retainedEvidenceCount = numberValue(coverage.captureCount, sourceCaptures.length)
    const url = stringValue(record.url)

    return {
        id,
        tenantId: stringValue(record.tenantId) || undefined,
        name: textValue(record.name, id),
        family: textValue(operations?.family, record.type, 'unknown'),
        type: textValue(record.type, 'unknown'),
        accessMethod: textValue(operatingMode.accessMethod, 'not recorded'),
        status: sourceStatus(record.status ?? operations?.lifecycleStatus),
        risk: sourceRisk(operatingMode.risk ?? record.risk),
        owner: textValue(record.owner, 'source-ops'),
        url,
        domain: hostname(url) || textValue(operations?.family, record.type, 'source'),
        lastRunAt,
        nextRunAt,
        executable: record.executable === true,
        monitoredSince,
        cadenceMinutes,
        retainedEvidenceCount,
        customerMatchCount: numberValue(coverage.customerMatchCount),
        productiveCycleCount: numberValue(qualification.productiveCheckCount, qualification.usefulCheckCount),
        qualifiesForBaseline: qualification.qualifies === true,
        qualificationReasons: listValue(qualification.reasons).map(stringValue).filter(Boolean),
        baselineFamily: textValue(qualification.family, 'not qualifying'),
        lastError: stringValue(health.lastFailureReason) || undefined,
        healthState: textValue(health.state, 'not observed'),
        lastCheckedAt: isoValue(qualification.lastCheckedAt, health.lastAttemptAt),
        lastContentAt: isoValue(qualification.lastContentAt),
        lastUsefulAt: isoValue(qualification.lastUsefulAt),
        backoffUntil: optionalIso(qualification.backoffUntil),
        domains: unique([...listValue(coverage.observedDomains).map(stringValue), ...sourceCaptures.map(capture => capture.domain)].filter(domain => domain && domain !== 'unresolved')),
        resultTypes: unique([...listValue(coverage.resultTypes).map(stringValue), ...sourceCaptures.map(capture => capture.pageType)].filter(Boolean)),
        buyerValue: retainedEvidenceCount ? `${retainedEvidenceCount} retained evidence capture${retainedEvidenceCount === 1 ? '' : 's'} recorded; this page shows a bounded recent sample.` : 'No accepted captures are stored for this source.',
        legalNotes: `${textValue(operatingMode.legalMode, 'operating mode not recorded')} · approval ${textValue(operatingMode.approvalState, 'not recorded')}`,
        screenshotIds: sourceCaptures.filter(capture => capture.screenshotLabel !== 'not captured').map(capture => capture.id),
        aiReview: toAiReview(automaticReview),
    }
}

function toAiReview(review: ApiPayload): TiAdminAiReview | undefined {
    const state = stringValue(review.state)
    if (!state) return undefined
    const status = state === 'approved'
        ? 'approved'
        : state === 'rejected'
            ? 'rejected'
            : state === 'stale'
                ? 'stale'
                : state === 'needs_review'
                    ? 'needs_human'
                    : 'pending'
    const confidence = Math.max(0, Math.min(1, numberValue(review.confidence)))
    return {
        reviewer: 'hanasand-ai',
        status,
        reviewedAt: isoValue(review.reviewedAt),
        confidencePercent: Math.round(confidence * 100),
        summary: state === 'approved'
            ? 'Approved from retained source evidence.'
            : state === 'rejected'
                ? 'Rejected from retained source evidence.'
                : state === 'stale'
                    ? 'The approved review no longer matches retained evidence.'
                    : state === 'needs_review'
                        ? 'Automatic review needs human follow-up.'
                        : 'Automatic review is pending.',
        checks: [textValue(review.claimValidity), textValue(review.modelVersion)].filter(Boolean),
    }
}

function sourceStatus(value: unknown): TiAdminSource['status'] {
    const status = stringValue(value).toLowerCase()
    if (['active', 'approved', 'canary'].includes(status)) return 'active'
    if (['paused', 'disabled', 'rejected'].includes(status)) return 'paused'
    if (['review', 'approval_required'].includes(status)) return 'review'
    return 'candidate'
}

function sourceRisk(value: unknown): TiAdminSource['risk'] {
    const risk = stringValue(value).toLowerCase()
    if (['restricted', 'high'].includes(risk)) return 'restricted'
    if (risk === 'medium') return 'medium'
    return 'low'
}
