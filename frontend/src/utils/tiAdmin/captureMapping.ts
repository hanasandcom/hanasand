import type { TiAdminCapture, TiAdminDomain } from './types'
import type { ApiPayload } from './values'
import { hostname, isoValue, listValue, objectValue, stringValue, textValue, titleCase, unique } from './values'

export function toCapture(record: ApiPayload): TiAdminCapture | undefined {
    const id = stringValue(record.id)
    const sourceId = stringValue(record.sourceId)
    const capturedAt = isoValue(record.collectedAt)
    if (!id || !sourceId || !capturedAt) return undefined
    const metadata = objectValue(record.metadata)
    const normalizedEvidence = objectValue(record.normalizedEvidence ?? metadata.normalizedEvidence)
    const provenance = objectValue(record.provenance)
    const publicUrl = stringValue(record.url)
    const domain = captureDomain(metadata, publicUrl)
    const screenshotId = textValue(metadata.screenshotId, metadata.screenshotHash)
    const sourceName = textValue(record.sourceName, sourceId)
    const actor = textValue(metadata.actor, metadata.group, metadata.threatActor, metadata.entity, domain, 'Source observation')
    const title = textValue(metadata.title, metadata.headline, metadata.claimTitle, `${actor} capture`)
    const publishedAt = isoValue(record.publishedAt, capturedAt)
    const pageType = textValue(metadata.pageType, metadata.kind, metadata.adapter, record.mediaType, record.storageKind, 'capture')

    return {
        id,
        sourceId,
        sourceName,
        sourceFamily: textValue(record.sourceFamily, 'source'),
        domain,
        actor,
        title,
        publishedAt,
        capturedAt,
        monitoredSince: isoValue(provenance.firstObservedAt, publishedAt, capturedAt),
        owner: textValue(metadata.owner, 'source-ops'),
        pageUrl: publicUrl || (record.locatorRedacted ? 'restricted locator redacted' : 'not recorded'),
        pageType,
        screenshotLabel: screenshotId || 'not captured',
        screenshotTakenAt: isoValue(metadata.screenshotTakenAt, capturedAt),
        resultSummary: captureSummary(sourceName, pageType, metadata, record),
        metadata: captureMetadata(record, metadata),
        normalizedEvidence: {
            status: textValue(normalizedEvidence.status, 'unparsed'),
            failureReason: textValue(normalizedEvidence.failureReason) || undefined,
            title: textValue(normalizedEvidence.title) || undefined,
            author: textValue(normalizedEvidence.author) || undefined,
            publishedAt: textValue(normalizedEvidence.publishedAt) || undefined,
            headings: listValue(normalizedEvidence.headings).map(stringValue).filter(Boolean),
            namedEntities: listValue(normalizedEvidence.namedEntities).map(stringValue).filter(Boolean),
            incidentLanguage: listValue(normalizedEvidence.incidentLanguage).map(stringValue).filter(Boolean),
            text: textValue(normalizedEvidence.text),
            excerpt: textValue(normalizedEvidence.excerpt),
        },
    }
}

function captureSummary(sourceName: string, pageType: string, metadata: ApiPayload, record: ApiPayload) {
    const normalized = objectValue(record.normalizedEvidence ?? metadata.normalizedEvidence)
    const summary = textValue(normalized.excerpt, normalized.text, metadata.summary, metadata.headline, record.redactionReason)
    if (summary && !noisyCaptureText(summary)) return summary
    const excerpt = textValue(normalized.excerpt, normalized.text, metadata.safeExcerpt, metadata.excerpt)
    if (excerpt && !noisyCaptureText(excerpt)) return excerpt
    const failureReason = textValue(normalized.failureReason, record.redactionReason)
    return failureReason || `Captured ${pageType} content from ${sourceName}; no readable excerpt was available.`
}

function noisyCaptureText(value: string) {
    return value.length > 240 || /(?:window\.|WIZ_global_data|__NEXT_DATA__|\{\\?"|\[\\?"|<html|<script)/i.test(value)
}

export function domainsFromCaptures(captures: TiAdminCapture[]): TiAdminDomain[] {
    const grouped = new Map<string, TiAdminCapture[]>()
    for (const capture of captures) {
        if (capture.domain === 'unresolved') continue
        grouped.set(capture.domain, [...(grouped.get(capture.domain) || []), capture])
    }
    return [...grouped.entries()].map(([domain, rows]) => ({
        domain,
        company: titleCase(domain.split('.')[0].replaceAll('-', ' ')),
        matchedTerms: [domain],
        sourceIds: unique(rows.map(row => row.sourceId)),
        resultCount: rows.length,
        lastSeenAt: rows.map(row => row.capturedAt).sort().at(-1)!,
        status: 'review' as const,
    })).sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))
}

function captureMetadata(record: ApiPayload, metadata: ApiPayload) {
    const rows = [
        ['Content hash', record.contentHash],
        ['Storage', record.storageKind],
        ['Media type', record.mediaType],
        ['Retention', record.retentionClass],
        ['Parser', metadata.parserVersion ?? metadata.extractorVersion],
        ['Review', metadata.reviewState],
    ]
    return rows.map(([label, value]) => ({ label: String(label), value: textValue(value) })).filter(row => row.value)
}

function captureDomain(metadata: ApiPayload, url: string) {
    const direct = textValue(metadata.domain, metadata.victimDomain, metadata.hostname)
    if (direct) return direct.toLowerCase()
    const matched = listValue(metadata.matchedWatchTerms).map(item => stringValue(item)).find(value => value.includes('.'))
    return (matched || hostname(url) || 'unresolved').toLowerCase()
}
