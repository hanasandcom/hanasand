import type { TiActionabilityContract } from '@/utils/ti/search'
import { publicTiText } from './publicResultText'

export function sanitizeActionability(actionability?: TiActionabilityContract): TiActionabilityContract | undefined {
    if (!actionability) return undefined

    return {
        schemaVersion: actionability.schemaVersion,
        alertDisposition: actionability.alertDisposition,
        shouldAlert: actionability.shouldAlert,
        rationale: actionability.rationale ? publicTiText(actionability.rationale) : undefined,
        watchlistCandidates: actionability.watchlistCandidates?.map(candidate => ({
            kind: candidate.kind,
            value: candidate.value,
            reason: publicTiText(candidate.reason),
            confidence: candidate.confidence
        })),
        watchlistMatches: actionability.watchlistMatches?.map(match => ({
            tenantId: match.tenantId,
            organizationId: match.organizationId,
            watchlistId: match.watchlistId,
            watchlistItemId: match.watchlistItemId,
            kind: match.kind,
            value: match.value,
            route: match.route,
            casePath: match.casePath
        })),
        relatedAlerts: actionability.relatedAlerts?.map(alert => ({
            id: alert.id,
            title: publicTiText(alert.title),
            status: alert.status,
            severity: alert.severity,
            caseIdCandidate: alert.caseIdCandidate,
            casePath: alert.casePath,
            source: alert.source ? publicTiText(alert.source) : undefined,
            tenantId: alert.tenantId,
            organizationId: alert.organizationId,
            dedupeKey: alert.dedupeKey,
            recommendedRoute: alert.recommendedRoute,
            captureIds: alert.captureIds,
            evidenceCount: alert.evidenceCount,
            webhookDestinationIds: alert.webhookDestinationIds,
            deliveryReadinessContext: alert.deliveryReadinessContext
        })),
        relatedCases: actionability.relatedCases?.map(item => ({
            id: item.id,
            title: publicTiText(item.title),
            status: item.status,
            priority: item.priority,
            path: item.path
        })),
        relatedWebhookDestinations: actionability.relatedWebhookDestinations?.map(destination => ({
            id: destination.id,
            name: publicTiText(destination.name),
            status: destination.status,
            path: destination.path
        })),
        sourceProvenance: actionability.sourceProvenance?.map(source => ({
            sourceId: source.sourceId,
            sourceName: publicTiText(source.sourceName),
            provenance: publicTiText(source.provenance),
            captureId: source.captureId,
            sourceRequestId: source.sourceRequestId,
            sourceFamily: source.sourceFamily,
            parserStatus: source.parserStatus,
            reportDate: source.reportDate,
            lastCollectedAt: source.lastCollectedAt,
            confidence: source.confidence
        })),
        enrichmentGaps: actionability.enrichmentGaps?.map(gap => ({
            id: gap.id,
            title: publicTiText(gap.title),
            severity: gap.severity,
            detail: publicTiText(gap.detail),
            dependency: publicTiText(gap.dependency),
            route: gap.route,
            sourceFamily: gap.sourceFamily,
            requestedFields: gap.requestedFields
        })),
        handoffs: actionability.handoffs,
        entitlementReadiness: actionability.entitlementReadiness
    }
}
