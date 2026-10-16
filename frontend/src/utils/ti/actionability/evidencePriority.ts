import type { TiSearchResponse, TiActionabilityContract } from '../search'
import type { TiActorIntelligenceProfile } from '../actorIntelligence'
import type { VictimObservation } from '../actorProfile'
import type { PublicTiReadinessContract } from './types/actionability'
import type { PublicTiOrgRelevanceProof } from './types/organizationRelevance'
import type { PublicTiEvidencePriority } from './types/evidence'
import { uniqueStrings } from './geography'

export function buildEvidencePriority(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    victimObservations: VictimObservation[]
    readiness: PublicTiReadinessContract
    orgRelevance: PublicTiOrgRelevanceProof
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
}): PublicTiEvidencePriority[] {
    const matchedTerms = input.orgRelevance.candidateTerms.filter(term => term.matched).map(term => `${term.kind}: ${term.value}`)
    const candidateTerms = input.orgRelevance.candidateTerms.map(term => `${term.kind}: ${term.value}`)
    const captureIds = uniqueStrings([
        ...input.sourceProvenance.map(source => source.captureId),
        ...input.orgRelevance.alertCaseRefs.flatMap(ref => ref.captureIds),
    ])
    const alertIds = uniqueStrings(input.relatedAlerts.map(alert => alert.id))
    const casePaths = uniqueStrings([
        ...input.relatedAlerts.map(alert => alert.casePath),
        ...input.relatedCases.map(item => item.path),
    ])
    const sourceIds = uniqueStrings(input.sourceProvenance.map(source => source.sourceId))
    const sharedReasons = [
        matchedTerms.length ? `Matched watchlist context: ${matchedTerms.slice(0, 3).join(', ')}.` : candidateTerms.length ? `Watchlist candidates: ${candidateTerms.slice(0, 3).join(', ')}.` : 'No organization watchlist match is attached.',
        captureIds.length ? `${captureIds.length} capture reference${captureIds.length === 1 ? '' : 's'} attached.` : 'Capture reference is missing.',
        alertIds.length ? `${alertIds.length} related alert${alertIds.length === 1 ? '' : 's'} attached.` : 'No related alert ID is attached.',
        input.actor.freshness.stale ? input.actor.freshness.reason : 'Actor freshness is acceptable for review.',
    ]
    const sharedBlockers = input.readiness.blockers.filter(blocker => [
        'missing_org',
        'missing_org_watchlist',
        'missing_source_provenance',
        'missing_capture',
        'missing_alert',
        'missing_case_route',
        'stale_provenance',
    ].includes(blocker.code))
    const priorityState = (): PublicTiEvidencePriority['state'] => {
        if (!input.sourceProvenance.length || sharedBlockers.some(blocker => blocker.code === 'missing_source_provenance')) return 'blocked'
        if (sharedBlockers.length || input.actor.freshness.stale) return 'review'
        return 'ready'
    }
    const baseScore = (confidence: number, severity: 'critical' | 'high' | 'medium' | 'low') => {
        const severityScore = severity === 'critical' ? 55 : severity === 'high' ? 42 : severity === 'medium' ? 28 : 14
        return severityScore + Math.round(confidence * 30) + (matchedTerms.length ? 12 : 0) + (captureIds.length ? 8 : 0) + (alertIds.length ? 8 : 0) - (input.actor.freshness.stale ? 6 : 0)
    }
    const sourceForActivity = (sourceIdsForRow: string[]) => uniqueStrings([
        ...sourceIdsForRow,
        ...sourceIds,
    ])
    const activityRows = input.result.recentActivity.map((item, index) => {
        const exposure = item.victimName || item.claimType === 'victim_claim' || /victim|leak|claim|stolen|exfiltrat|credential/i.test(`${item.title} ${item.detail}`)
        const severity = exposure ? 'high' : item.confidence >= 0.75 ? 'medium' : 'low'
        return priorityRow({
            rowId: queueRowId('activity', index, item.date, item.title),
            label: item.victimName || item.title,
            score: baseScore(item.confidence, severity),
            state: priorityState(),
            sourceIds: sourceForActivity(item.sourceIds),
            captureIds,
            alertIds,
            casePaths,
            watchlistTerms: matchedTerms.length ? matchedTerms : candidateTerms,
            blockers: sharedBlockers,
            route: casePaths[0] || input.relatedAlerts[0]?.recommendedRoute,
            reasons: [
                `${item.confidence >= 0.75 ? 'High' : 'Review'} confidence activity row.`,
                item.affectedSectors?.length ? `Affected sectors: ${item.affectedSectors.slice(0, 3).join(', ')}.` : 'Affected sector needs source detail.',
                ...sharedReasons,
            ],
        })
    })
    const victimRows = input.victimObservations.map((item, index) => priorityRow({
        rowId: queueRowId('victim', index, '', item.victim),
        label: item.victim,
        score: baseScore(item.confidence, item.confidence >= 0.85 ? 'high' : item.confidence >= 0.65 ? 'medium' : 'low'),
        state: priorityState(),
        sourceIds: uniqueStrings([...item.sourceIds, ...sourceIds]),
        captureIds,
        alertIds,
        casePaths,
        watchlistTerms: matchedTerms.length ? matchedTerms : candidateTerms,
        blockers: sharedBlockers,
        route: casePaths[0],
        reasons: [
            `Targeting evidence for ${item.country} and ${item.sector}.`,
            `Evidence strength: ${item.source}.`,
            ...sharedReasons,
        ],
    }))

    const rows = [...activityRows, ...victimRows]
    if (!rows.length) {
        rows.push(priorityRow({
            rowId: 'collection-searching',
            label: input.result.status === 'searching' ? 'Collection running' : 'No actionable rows yet',
            score: input.sourceProvenance.length ? 35 : 12,
            state: input.sourceProvenance.length ? 'review' : 'blocked',
            sourceIds,
            captureIds,
            alertIds,
            casePaths,
            watchlistTerms: candidateTerms,
            blockers: sharedBlockers,
            reasons: [
                input.sourceProvenance.length ? `${input.sourceProvenance.length} source row${input.sourceProvenance.length === 1 ? '' : 's'} attached.` : 'No source row is attached yet.',
                ...sharedReasons,
            ],
        }))
    }
    return rows.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, 12)
}

export function priorityRow(input: Omit<PublicTiEvidencePriority, 'schemaVersion' | 'nextAction'>): PublicTiEvidencePriority {
    return {
        schemaVersion: 'ti.public_actor.evidence_priority.v1',
        ...input,
        score: Math.max(0, Math.min(100, input.score)),
        reasons: uniqueStrings(input.reasons).slice(0, 8),
        nextAction: input.state === 'ready'
            ? 'Open the related console record or prepare customer review.'
            : input.state === 'review'
                ? 'Review missing source, watchlist, alert, or freshness context before routing.'
                : 'Collect source details and organization context before routing.',
    }
}

export function queueRowId(kind: 'activity' | 'victim', index: number, timestamp: string, label: string) {
    if (kind === 'activity') return `activity-${index}-${timestamp}-${label}`.toLowerCase()
    return `victim-${index}-${label}`.toLowerCase()
}
