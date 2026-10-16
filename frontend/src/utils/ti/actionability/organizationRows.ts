import type { TiActionabilityContract } from '../search'
import type { PublicTiOrgRelevanceProof, PublicTiOrgRelevanceEnrichmentGap, PublicTiOrgRelevanceRow } from './types/organizationRelevance'
import type { PublicTiReadinessBlocker } from './types/actionability'
import { uniqueStrings, uniqueBy } from './geography'
import { sourceRefsForTerm, rowEvidenceFor, sourceFamilyForEvidence, ownerLaneForGap, blockersForGap, formatGapCode, sourceFamilyForReadinessBlocker } from './organizationEvidence'
import { routeForGap, sourceFamilyForGap } from './normalization'

export function buildOrgRelevanceRows(input: {
    actorId: string
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    candidateTerms: PublicTiOrgRelevanceProof['candidateTerms']
    sourceEvidence: PublicTiOrgRelevanceProof['sourceEvidence']
    alertCaseRefs: PublicTiOrgRelevanceProof['alertCaseRefs']
    enrichmentGaps: NonNullable<TiActionabilityContract['enrichmentGaps']>
    orgEnrichmentGaps: PublicTiOrgRelevanceEnrichmentGap[]
    blockers: PublicTiReadinessBlocker[]
}): PublicTiOrgRelevanceRow[] {
    const rowBlockers = (codes: PublicTiReadinessBlocker['code'][]) => input.blockers.filter(blocker => codes.includes(blocker.code))
    const rows: PublicTiOrgRelevanceRow[] = []

    for (const match of input.matches) {
        const provenanceRefs = uniqueStrings([
            match.watchlistId,
            match.watchlistItemId,
            ...sourceRefsForTerm(match.value, input.sourceEvidence),
        ])
        rows.push({
            rowId: `watchlist:${match.watchlistItemId ?? match.value}`,
            kind: 'watchlist_match',
            state: match.organizationId && match.watchlistId && match.watchlistItemId ? 'ready' : 'blocked',
            ownerLane: 'org',
            label: match.value,
            action: 'Open saved watchlist item',
            route: match.casePath ?? match.route ?? '/findings',
            sourceFamily: 'watchlist',
            provenanceRefs,
            tenantId: match.tenantId,
            organizationId: match.organizationId,
            watchlistId: match.watchlistId,
            watchlistItemId: match.watchlistItemId,
            captureIds: [],
            webhookDestinationIds: [],
            evidence: rowEvidenceFor(provenanceRefs, input.sourceEvidence, `Saved watchlist item for ${match.value}.`),
            blockers: match.organizationId && match.watchlistId && match.watchlistItemId ? [] : rowBlockers(['missing_org', 'missing_org_watchlist']),
        })
    }

    for (const term of input.candidateTerms) {
        const blockers = term.matched ? [] : rowBlockers(['missing_org_watchlist'])
        const provenanceRefs = uniqueStrings(term.sourceEvidenceRefs)
        rows.push({
            rowId: `term:${term.kind}:${term.value.toLowerCase()}`,
            kind: 'candidate_term',
            state: blockers.length ? 'blocked' : term.matched ? 'ready' : 'review',
            ownerLane: 'org',
            label: `${term.kind}: ${term.value}`,
            action: term.matched ? 'Use matched watchlist item' : 'Persist as watchlist item',
            route: '/v1/dwm/watchlists',
            sourceFamily: 'watchlist',
            provenanceRefs,
            captureIds: provenanceRefs.filter(ref => /^capture/i.test(ref)),
            webhookDestinationIds: [],
            evidence: rowEvidenceFor(provenanceRefs, input.sourceEvidence, term.notes || `Candidate watchlist term for ${term.value}.`),
            blockers,
        })
    }

    for (const source of input.sourceEvidence) {
        const blockers = source.captureId ? [] : rowBlockers(['missing_capture'])
        const provenanceRefs = uniqueStrings([source.sourceId, source.captureId, source.provenance])
        rows.push({
            rowId: `source:${source.sourceId ?? source.sourceName}:${source.captureId ?? source.provenance}`,
            kind: 'source_evidence',
            state: blockers.length ? 'blocked' : 'ready',
            ownerLane: 'source',
            label: source.sourceName,
            action: source.captureId ? 'Use capture as evidence' : 'Attach capture ID',
            route: '/ti/profiles',
            sourceFamily: sourceFamilyForEvidence(source),
            provenanceRefs,
            captureIds: uniqueStrings([source.captureId]),
            webhookDestinationIds: [],
            evidence: rowEvidenceFor(provenanceRefs, input.sourceEvidence, source.shownBecause),
            blockers,
        })
    }

    for (const alert of input.alertCaseRefs) {
        const caseBlockers = alert.casePath ? [] : rowBlockers(['missing_case_route'])
        const captureBlockers = alert.captureIds.length ? [] : rowBlockers(['missing_capture'])
        const blockers = uniqueBy([...caseBlockers, ...captureBlockers], blocker => `${blocker.code}:${blocker.field}`)
        const alertProvenanceRefs = uniqueStrings([alert.alertId, alert.caseIdCandidate, alert.casePath, ...alert.captureIds])
        rows.push({
            rowId: `alert:${alert.alertId}`,
            kind: 'alert_case',
            state: blockers.length ? 'blocked' : 'ready',
            ownerLane: 'case',
            label: alert.alertId,
            action: alert.casePath ? 'Open related case' : 'Create case route',
            route: alert.casePath ?? '/v1/cases',
            sourceFamily: alert.casePath ? 'case' : 'alert',
            provenanceRefs: alertProvenanceRefs,
            tenantId: alert.tenantId,
            organizationId: alert.organizationId,
            alertId: alert.alertId,
            casePath: alert.casePath,
            captureIds: alert.captureIds,
            webhookDestinationIds: alert.webhookDestinationIds,
            evidence: rowEvidenceFor(alertProvenanceRefs, input.sourceEvidence, `Related alert ${alert.alertId} is attached to this actor result.`),
            blockers,
        })
        const webhookProvenanceRefs = uniqueStrings([alert.alertId, ...alert.captureIds, ...alert.webhookDestinationIds])
        rows.push({
            rowId: `webhook:${alert.alertId}`,
            kind: 'webhook_delivery',
            state: alert.webhookDestinationIds.length ? 'ready' : 'blocked',
            ownerLane: 'webhook',
            label: alert.alertId,
            action: alert.webhookDestinationIds.length ? 'Prepare delivery dry run' : 'Attach webhook destination',
            route: '/v1/dwm/webhooks/deliver',
            sourceFamily: 'webhook',
            provenanceRefs: webhookProvenanceRefs,
            tenantId: alert.tenantId,
            organizationId: alert.organizationId,
            alertId: alert.alertId,
            casePath: alert.casePath,
            captureIds: alert.captureIds,
            webhookDestinationIds: alert.webhookDestinationIds,
            evidence: rowEvidenceFor(webhookProvenanceRefs, input.sourceEvidence, `Webhook delivery readiness for alert ${alert.alertId}.`),
            blockers: alert.webhookDestinationIds.length ? [] : rowBlockers(['missing_webhook_destination']),
        })
    }

    for (const gap of input.enrichmentGaps) {
        const provenanceRefs = uniqueStrings([gap.id, gap.dependency])
        rows.push({
            rowId: `gap:${gap.id}`,
            kind: 'enrichment_gap',
            state: gap.severity === 'high' ? 'blocked' : 'review',
            ownerLane: ownerLaneForGap(gap),
            label: gap.title,
            action: gap.dependency,
            route: gap.route ?? routeForGap(gap),
            sourceFamily: gap.sourceFamily ?? sourceFamilyForGap(gap),
            provenanceRefs,
            captureIds: [],
            webhookDestinationIds: [],
            evidence: {
                summary: gap.detail,
            },
            blockers: blockersForGap(gap, input.blockers),
        })
    }

    for (const gap of input.orgEnrichmentGaps) {
        rows.push({
            rowId: `org-gap:${gap.code}:${gap.field}`,
            kind: 'enrichment_gap',
            state: gap.code === 'stale_evidence' || gap.code === 'missing_provenance' || gap.code === 'missing_source_coverage' ? 'blocked' : 'review',
            ownerLane: gap.ownerLane,
            label: formatGapCode(gap.code),
            action: gap.detail,
            route: gap.route,
            sourceFamily: gap.sourceFamily,
            provenanceRefs: uniqueStrings([gap.field]),
            captureIds: [],
            webhookDestinationIds: [],
            evidence: {
                summary: gap.detail,
            },
            blockers: [],
        })
    }

    for (const blocker of input.blockers) {
        if (rows.some(row => row.blockers.some(rowBlocker => rowBlocker.code === blocker.code && rowBlocker.field === blocker.field))) continue
        rows.push({
            rowId: `blocker:${blocker.code}:${blocker.field}`,
            kind: 'enrichment_gap',
            state: 'blocked',
            ownerLane: blocker.ownerLane,
            label: blocker.detail,
            action: blocker.handoff,
            route: blocker.route,
            sourceFamily: sourceFamilyForReadinessBlocker(blocker),
            provenanceRefs: uniqueStrings([blocker.field, blocker.handoff]),
            captureIds: [],
            webhookDestinationIds: [],
            evidence: {
                summary: blocker.detail,
            },
            blockers: [blocker],
        })
    }

    return uniqueBy(rows, row => row.rowId).slice(0, 48)
}
