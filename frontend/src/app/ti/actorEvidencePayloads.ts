import { coverageMissingLabel } from './pageModel'
import type { SelectedSourceDrilldown, SelectedSourceDrilldownRow } from './pageModel'
import type { TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'

export function captureCoverageLabel(coverage: TiActorIntelligenceProfile['sourceCoverage']) {
    if (coverage.captureRows) return `${coverage.captureRows} source row${coverage.captureRows === 1 ? '' : 's'} linked`
    if (coverage.missing.includes('sourceProvenance[].captureId')) return 'sources syncing'
    return 'source optional'
}
export function techniqueCoveragePayloadFor(item: TiActorIntelligenceProfile['techniqueCoverage'][number]) {
    const missing = item.missing.length ? item.missing : [
        item.sourceIds.length ? '' : 'sourceIds',
        item.captureIds.length ? '' : 'captureId',
        item.attackId ? '' : 'attackId',
        item.provenanceRefs.length ? '' : 'provenanceRefs',
    ].filter(Boolean)
    return {
        schemaVersion: 'ti.public_actor.technique_coverage.v1',
        attackId: item.attackId,
        name: item.name,
        tactic: item.tactic,
        detail: item.detail,
        confidence: item.confidence,
        freshness: item.freshness,
        sourceIds: item.sourceIds,
        captureIds: item.captureIds,
        provenanceRefs: item.provenanceRefs,
        route: missing.length ? '/ti/profiles' : '/ti/workbench',
        recommendedAction: missing.length ? 'queue_enrichment' : 'attach_to_case_review',
        blockedBy: missing.map(field => ({
            ownerLane: /capture|source|provenance/i.test(field) ? 'source' : 'public-ti',
            field,
            reason: `Attach ${coverageMissingLabel(field)} before using this technique row for case or detection review.`,
        })),
    }
}
export function campaignActivityPayloadFor(item: TiActorIntelligenceProfile['campaignTimeline'][number]) {
    const missing = item.missing.length ? item.missing : [
        item.sourceIds.length ? '' : 'sourceIds',
        item.provenanceRefs.length ? '' : 'provenanceRefs',
        Date.parse(item.firstReportedAt) || /\b(19|20)\d{2}\b/.test(item.firstReportedAt) ? '' : 'firstReportedAt',
    ].filter(Boolean)
    return {
        schemaVersion: 'ti.public_actor.campaign_activity.v1',
        title: item.title,
        firstReportedAt: item.firstReportedAt,
        confidence: item.confidence,
        freshness: item.freshness,
        affectedSectors: item.affectedSectors,
        countries: item.countries,
        sourceIds: item.sourceIds,
        provenanceRefs: item.provenanceRefs,
        route: missing.length ? '/ti/profiles' : '/ti/workbench',
        recommendedAction: missing.length ? 'queue_enrichment' : 'attach_to_case_review',
        blockedBy: missing.map(field => ({
            ownerLane: /source|provenance/i.test(field) ? 'source' : 'public-ti',
            field,
            reason: `Attach ${coverageMissingLabel(field)} before using this activity row for case review.`,
        })),
    }
}
export function sourceEvidenceRequestPayloadFor(row: SelectedSourceDrilldownRow, drilldown: SelectedSourceDrilldown) {
    return {
        schemaVersion: 'ti.public_actor.source_evidence_request.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: drilldown.query,
        generatedAt: drilldown.generatedAt,
        selectedItemId: drilldown.selectedItem.id,
        selectedItemTitle: drilldown.selectedItem.title,
        rowId: row.rowId,
        sourceName: row.sourceName,
        sourceId: row.sourceId,
        provenance: row.provenance,
        href: row.href,
        captureId: row.captureId,
        reportDate: row.reportDate,
        confidence: row.confidence,
        state: row.state,
        ownerLane: row.ownerLane,
        route: row.route,
        missing: row.missing,
        handoff: row.handoff,
    }
}
