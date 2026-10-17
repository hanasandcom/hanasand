import { activitySourceLabel, formatLabel, severityWeight, type AnalystWorkItem } from './pageModel'
import { evidenceTimestamp, type TiSearchResponse } from '@/utils/ti/search'
import type { TiActionabilityModel } from '@/utils/ti/actionability'
import type { victimObservationsFor } from '@/utils/ti/actorProfile'

export function analystWorkItemsFor(result: TiSearchResponse, victimObservations: ReturnType<typeof victimObservationsFor>, sourceUrlById: Map<string, string | undefined>, actionability: TiActionabilityModel): AnalystWorkItem[] {
    const priorityByRow = new Map(actionability.evidencePriority.map(priority => [priority.rowId, priority]))
    const activityItems: AnalystWorkItem[] = result.recentActivity.map((item, index) => {
        const href = item.url || item.sourceIds.map(id => sourceUrlById.get(id)).find(Boolean)
        const exposure = item.victimName || item.claimType === 'victim_claim' || /victim|leak|claim|stolen|exfiltrat|credential/i.test(`${item.title} ${item.detail}`)
        const id = `activity-${index}-${item.date}-${item.title}`.toLowerCase()
        const priority = priorityByRow.get(id)
        return {
            id,
            kind: exposure ? 'exposure' : 'activity',
            severity: exposure ? 'high' : item.confidence >= 0.75 ? 'medium' : 'low',
            status: exposure ? 'needs review' : 'monitor',
            title: item.victimName || item.title,
            subtitle: item.impact || item.detail,
            detail: item.detail,
            timestamp: evidenceTimestamp(item.firstReportedAt, item.date),
            source: activitySourceLabel(item.sourceIds.length),
            provenance: item.publisherCount ? `${item.publisherCount} publisher${item.publisherCount === 1 ? '' : 's'}` : 'Activity result',
            confidence: item.confidence,
            assertionKind: item.assertionKind || 'source_claim',
            reviewState: item.reviewState,
            corroborationState: item.corroborationState,
            observationSummary: item.observationSummary,
            href,
            evidence: [
                item.title,
                item.impact || item.detail,
                item.affectedSectors?.length ? `Affected sectors: ${item.affectedSectors.join(', ')}` : 'Affected sector not stated.',
                item.countries?.length ? `Countries: ${item.countries.join(', ')}` : 'Country not stated.',
            ],
            nextActions: exposure
                ? ['Review sources before customer alerting.', 'Check whether the victim/domain is in a watched portfolio.', 'Escalate if the claim is fresh, corroborated, or customer-relevant.']
                : ['Review for relevance to the selected actor or company.', 'Open the source when available.', 'Close if it is duplicate background reporting.'],
            priority,
        }
    })

    const victimItems: AnalystWorkItem[] = victimObservations.map((item, index) => {
        const id = `victim-${index}-${item.victim}`.toLowerCase()
        return {
            id,
            kind: 'victim',
            severity: item.confidence >= 0.85 ? 'high' : item.confidence >= 0.65 ? 'medium' : 'low',
            status: 'profile evidence',
            title: item.victim,
            subtitle: `${item.country} · ${item.sector}`,
            detail: item.incident,
            timestamp: item.timeframe,
            source: item.source,
            provenance: 'Country-level actor profile evidence',
            confidence: item.confidence,
            assertionKind: 'source_claim',
            evidence: [
                `Country: ${item.country}`,
                `Sector: ${item.sector}`,
                `Timeframe: ${item.timeframe}`,
                item.incident,
            ],
            nextActions: ['Use as actor profile context, not as a current alert by itself.', 'Corroborate with source links before notifying a customer.', 'Keep broad regions and alliance buckets out of the country map.'],
            priority: priorityByRow.get(id),
        }
    })

    const tradecraftItems: AnalystWorkItem[] = result.ttps.slice(0, 4).map((item, index) => ({
        id: `ttp-${index}-${item.attackId || item.name}`.toLowerCase(),
        kind: 'tradecraft',
        severity: item.confidence >= 0.8 ? 'medium' : 'low',
        status: 'detection context',
        title: item.attackId ? `${item.attackId} ${item.name}` : item.name,
        subtitle: item.tactic,
        detail: item.detail,
        timestamp: 'Observation date unavailable',
        source: 'Actor profile',
        provenance: item.attackId ? 'MITRE ATT&CK mapped profile field' : 'Profile tradecraft field',
        confidence: item.confidence,
        assertionKind: 'extracted',
        evidence: [item.tactic, item.detail],
        nextActions: ['Map to defensive detections or hunting queries.', 'Prioritize techniques that match current exposure or recent activity.', 'Close if this is generic background for the current shift.'],
    }))

    const reviewItems: AnalystWorkItem[] = result.analystLoop?.metadataReviewInbox.map((item, index) => ({
        id: `review-${item.id || index}`.toLowerCase(),
        kind: 'exposure',
        severity: item.allowedActions.includes('notify_company') ? 'critical' : 'high',
        status: item.status.replaceAll('_', ' '),
        title: item.company || item.victim || 'Recent attack mention',
        subtitle: [item.affectedAccounts, item.datasetSize, item.claimedDate].filter(Boolean).join(' · ') || 'Sensitive-source review item',
        detail: item.actorStatement || 'Review the captured safe fields before taking action.',
        timestamp: evidenceTimestamp(item.claimedDate),
        source: item.sourceHash ? `source hash ${item.sourceHash}` : 'Sensitive-source review inbox',
        provenance: item.provenance || 'Sensitive-source review',
        confidence: item.confidence,
        assertionKind: 'source_claim',
        evidence: [
            item.affectedAccounts ? `Affected accounts: ${item.affectedAccounts}` : 'Affected accounts not stated.',
            item.accountSubjects ? `Account subjects: ${item.accountSubjects}` : 'Account subjects not stated.',
            item.datasetSize ? `Dataset size: ${item.datasetSize}` : 'Dataset size not stated.',
            item.actorStatement ? `Actor statement: ${item.actorStatement}` : 'Actor statement is not in the safe fields.',
        ],
        nextActions: item.allowedActions.map(action => formatLabel(action)),
    })) ?? []

    return [...reviewItems, ...activityItems, ...victimItems, ...tradecraftItems]
        .sort((a, b) => (b.priority?.score ?? 0) - (a.priority?.score ?? 0) || severityWeight(b.severity) - severityWeight(a.severity) || b.confidence - a.confidence)
}
