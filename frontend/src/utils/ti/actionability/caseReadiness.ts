import type { TiSearchResponse } from '../search'
import type { PublicTiEvidencePriority } from './types/evidence'
import type { PublicTiReadinessContract, PublicTiReadinessBlocker } from './types/actionability'
import type { PublicTiCaseReviewIntake, PublicTiCaseReviewIntakeItem, PublicTiCaseReplayReadinessExport, PublicTiCaseReplayReadinessRow } from './types/caseReadiness'
import { uniqueStrings, uniqueBy } from './geography'
import type { EnrichmentGapQueueItem } from './types/sourceEnrichment'
import type { PublicTiOrgSourceFamily } from './types/organizationRelevance'

export function buildPublicTiCaseReviewIntake(input: {
    result: TiSearchResponse
    evidencePriority: PublicTiEvidencePriority[]
    readiness: PublicTiReadinessContract
}): PublicTiCaseReviewIntake {
    const items = input.evidencePriority.map((row): PublicTiCaseReviewIntakeItem => {
        const blockedBy = caseIntakeBlockers(row, input.readiness)
        const state: PublicTiEvidencePriority['state'] = row.state === 'ready' && blockedBy.length ? 'review' : row.state
        return {
            schemaVersion: 'ti.public_actor.case_review_intake_item.v1',
            id: `case-intake:${row.rowId}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            evidenceRowId: row.rowId,
            title: row.label,
            score: row.score,
            state,
            route: row.casePaths[0] || row.route || '/ti/workbench',
            priority: casePriorityForScore(row.score),
            alertIds: row.alertIds,
            casePaths: row.casePaths,
            captureIds: row.captureIds,
            sourceIds: row.sourceIds,
            watchlistTerms: row.watchlistTerms,
            reasons: row.reasons,
            blockedBy,
            recommendedAction: caseIntakeAction(row, blockedBy),
            nextAction: row.nextAction,
        }
    })

    return {
        schemaVersion: 'ti.public_actor.case_review_intake.v1',
        query: input.result.query,
        generatedAt: input.result.generatedAt,
        route: '/v1/cases',
        items,
        summary: {
            total: items.length,
            ready: items.filter(item => item.state === 'ready').length,
            review: items.filter(item => item.state === 'review').length,
            blocked: items.filter(item => item.state === 'blocked').length,
            alerts: uniqueStrings(items.flatMap(item => item.alertIds)).length,
            caseRoutes: uniqueStrings(items.flatMap(item => item.casePaths)).length,
            captures: uniqueStrings(items.flatMap(item => item.captureIds)).length,
        },
    }
}

export function buildPublicTiCaseReplayReadiness(input: {
    result: TiSearchResponse
    caseReviewIntake: PublicTiCaseReviewIntake
}): PublicTiCaseReplayReadinessExport {
    const rows = input.caseReviewIntake.items.map((item): PublicTiCaseReplayReadinessRow => {
        const casePath = item.casePaths[0]
        const alertId = item.alertIds[0]
        const caseId = caseIdFromPath(casePath)
        const blockerCodes = uniqueStrings([
            caseId ? undefined : 'missing_case_route',
            alertId ? undefined : 'missing_alert',
            item.captureIds.length ? undefined : 'missing_capture',
            item.blockedBy.some(blocker => blocker.code === 'stale_provenance') ? 'stale_provenance' : undefined,
            item.sourceIds.length ? undefined : 'missing_source_provenance',
        ].filter((value): value is PublicTiCaseReplayReadinessRow['blockerCodes'][number] => Boolean(value))) as PublicTiCaseReplayReadinessRow['blockerCodes']
        const ready = blockerCodes.length === 0
        return {
            schemaVersion: 'ti.public_actor.case_action_replay_readiness_row.v1',
            id: `case-replay:${item.id}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            caseReviewIntakeItemId: item.id,
            evidenceRowId: item.evidenceRowId,
            title: item.title,
            ready,
            state: ready ? 'ready' : 'blocked',
            exportRoute: caseId ? caseActionReplayRoute(caseId, alertId) : undefined,
            caseId,
            alertIds: item.alertIds,
            captureIds: item.captureIds,
            sourceIds: item.sourceIds,
            blockerCodes,
            blockedBy: item.blockedBy,
            replayPlan: {
                actionId: 'alertReplay',
                eventAction: 'handoff_alert_replay',
                replayable: ready,
                metadataOnly: true,
            },
            provenance: {
                casePaths: item.casePaths,
                watchlistTerms: item.watchlistTerms,
                reasons: item.reasons,
            },
        }
    })

    return {
        schemaVersion: 'ti.public_actor.case_action_replay_readiness.v1',
        sourceContractSchemaVersion: 'dwm.case_action_replay_export.v1',
        query: input.result.query,
        generatedAt: input.result.generatedAt,
        routeTemplate: '/v1/cases/:caseId/action-replay-export',
        rows,
        summary: {
            total: rows.length,
            ready: rows.filter(row => row.ready).length,
            blocked: rows.filter(row => !row.ready).length,
            replayable: rows.some(row => row.ready),
            alertIds: uniqueStrings(rows.flatMap(row => row.alertIds)).length,
            caseRoutes: uniqueStrings(rows.flatMap(row => row.provenance.casePaths)).length,
            captures: uniqueStrings(rows.flatMap(row => row.captureIds)).length,
        },
        safeOutput: {
            metadataOnly: true,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
            liveMutation: false,
        },
    }
}

export function caseIdFromPath(path?: string) {
    if (!path) return undefined
    const match = path.match(/\/v1\/cases\/([^/?#]+)/)
    return match?.[1]
}

export function caseActionReplayRoute(caseId: string, alertId?: string) {
    const params = new URLSearchParams({
        actionId: 'alertReplay',
        eventAction: 'handoff_alert_replay',
    })
    if (alertId) params.set('alertId', alertId)
    return `/v1/cases/${encodeURIComponent(caseId)}/action-replay-export?${params.toString()}`
}

export function caseIntakeBlockers(row: PublicTiEvidencePriority, readiness: PublicTiReadinessContract): PublicTiReadinessBlocker[] {
    return uniqueBy([
        ...row.blockers,
        ...readiness.blockers.filter(blocker => {
            if (blocker.code === 'missing_alert') return !row.alertIds.length
            if (blocker.code === 'missing_capture') return !row.captureIds.length
            if (blocker.code === 'missing_case_route') return !row.casePaths.length
            if (blocker.code === 'missing_org' || blocker.code === 'missing_org_watchlist') return !row.watchlistTerms.length
            if (blocker.code === 'stale_provenance') return row.state !== 'ready'
            return false
        }),
    ], blocker => `${blocker.code}:${blocker.stage}:${blocker.field}`)
}

export function caseIntakeAction(row: PublicTiEvidencePriority, blockers: PublicTiReadinessBlocker[]): PublicTiCaseReviewIntakeItem['recommendedAction'] {
    if (row.casePaths.length) return 'open_case'
    if (row.alertIds.length) return 'open_alert'
    if (blockers.some(blocker => blocker.code === 'missing_capture')) return 'attach_capture'
    if (blockers.some(blocker => blocker.code === 'stale_provenance')) return 'refresh_evidence'
    return 'rebuild_alert'
}

export function casePriorityForScore(score: number): PublicTiCaseReviewIntakeItem['priority'] {
    if (score >= 85) return 'critical'
    if (score >= 70) return 'high'
    if (score >= 45) return 'medium'
    return 'low'
}

export function sourceHealthFamilyForGap(sourceFamily: EnrichmentGapQueueItem['sourceFamily']): PublicTiOrgSourceFamily {
    if (sourceFamily === 'actor_profile' || sourceFamily === 'source_capture' || sourceFamily === 'watchlist' || sourceFamily === 'alert' || sourceFamily === 'case' || sourceFamily === 'geography' || sourceFamily === 'indicator') return sourceFamily
    return 'source_capture'
}
