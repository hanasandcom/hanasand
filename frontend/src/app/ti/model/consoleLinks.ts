import { type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type SelectedAlertActionPlan, type SelectedCaseCreateRequest, type SelectedWatchlistPlan } from './types'
import { selectedSourceDrilldownFor } from './sourceDrilldown'
import { PUBLIC_TI_HANDOFF_ACTIONS, type ActorArtifactHandoffs } from '@/utils/ti/actorWorkbench'
import { authenticatedPublicTiHref } from './handoffPayload'

export function selectedConsoleLinksFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    watchlistPlan: SelectedWatchlistPlan | null,
    caseCreateRequest: SelectedCaseCreateRequest | null,
    alertPlan: SelectedAlertActionPlan | null,
    sourceDrilldown: ReturnType<typeof selectedSourceDrilldownFor> | null,
    artifactHandoffs: ActorArtifactHandoffs | null
) {
    const baseParams = {
        actor: result.query,
        selected: selected.id,
        source: selected.source,
        evidence: selected.priority?.rowId,
        sourceId: selected.priority?.sourceIds[0] ?? sourceDrilldown?.rows[0]?.sourceId,
        captureId: selected.priority?.captureIds[0] ?? sourceDrilldown?.rows.find(row => row.captureId)?.captureId,
    }
    return {
        watchlist: authenticatedPublicTiHref(watchlistPlan?.route, {
            ...baseParams,
            action: 'watchlist',
            term: watchlistPlan?.terms[0]?.value,
            state: watchlistPlan?.state,
        }, artifactHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist]),
        case: authenticatedPublicTiHref(caseCreateRequest?.route, {
            ...baseParams,
            action: 'case',
            caseState: caseCreateRequest?.state,
            caseRoute: caseCreateRequest?.refs.casePaths[0],
            alertId: caseCreateRequest?.refs.alertIds[0],
        }, artifactHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case]),
        alert: authenticatedPublicTiHref(alertPlan?.route, {
            ...baseParams,
            action: 'alert',
            alertState: alertPlan?.state,
            alertId: alertPlan?.sourceRefs.alertIds[0],
        }, artifactHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild]),
    }
}
