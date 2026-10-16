import { type TiSearchResponse } from '@/utils/ti/search'
import { type AnalystWorkItem, type SelectedAlertActionPlan, type SelectedCaseOwnershipPlan, type SelectedDeliveryReadinessPlan } from './types'
import { type TiActionabilityModel } from '@/utils/ti/actionability'
import { unique } from './evidenceValues'
import { displayRequirementList } from './requirementCopy'
import { consumerRequestActionLabel } from './sourceLinks'
import { formatLabel } from './reviewLabels'

export function selectedDeliveryReadinessPlanFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    alertPlan: SelectedAlertActionPlan | null,
    caseOwnership: SelectedCaseOwnershipPlan | null
): SelectedDeliveryReadinessPlan {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedAlertIds = selected.priority?.alertIds ?? []
    const selectedCaptureIds = selected.priority?.captureIds ?? []
    const selectedCasePaths = selected.priority?.casePaths ?? []
    const text = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const matchedAlerts = actionability.relatedAlerts.filter(alert =>
        selectedAlertIds.includes(alert.id)
        || text.includes(alert.id.toLowerCase())
        || (alert.captureIds ?? []).some(captureId => selectedCaptureIds.includes(captureId) || text.includes(captureId.toLowerCase()))
        || Boolean(alert.casePath && (selectedCasePaths.includes(alert.casePath) || text.includes(alert.casePath.toLowerCase())))
        || alertPlan?.sourceRefs.alertIds.includes(alert.id)
        || caseOwnership?.sourceRefs.alertIds.includes(alert.id)
    )
    const activeAlerts = matchedAlerts.length ? matchedAlerts : actionability.relatedAlerts.slice(0, 3)
    const deliveryStage = actionability.consumerReadiness.stages.find(stage => stage.id === 'webhookTrigger')
    const alertRows = activeAlerts.map(alert => {
        const context = alert.deliveryReadinessContext
        const captureIds = unique([...(alert.captureIds ?? []), ...(context?.selectedCaptureIds ?? [])])
        const destinationIds = unique([...(alert.webhookDestinationIds ?? []), ...(context?.webhookDestinationIds ?? [])])
        const blockers = unique([
            ...(context?.blockerCodes ?? []).map(deliveryBlockerLabel),
            ...(captureIds.length ? [] : ['Capture evidence is required before delivery review.']),
            ...(destinationIds.length ? [] : ['Active webhook destination is required before delivery review.']),
            ...(alert.casePath || context?.casePath ? [] : ['Case link is required before delivery review.']),
        ]).slice(0, 8)
        return {
            id: alert.id,
            title: alert.title,
            status: alert.status,
            ready: Boolean(context?.ready) && blockers.length === 0,
            casePath: alert.casePath ?? context?.casePath,
            captureIds,
            destinationIds,
            blockers,
            recommendedRoute: alert.recommendedRoute,
        }
    })
    const sourceRefs = {
        alertIds: unique([...activeAlerts.map(alert => alert.id), ...(alertPlan?.sourceRefs.alertIds ?? [])]),
        captureIds: unique([
            ...activeAlerts.flatMap(alert => [...(alert.captureIds ?? []), ...(alert.deliveryReadinessContext?.selectedCaptureIds ?? [])]),
            ...(alertPlan?.sourceRefs.captureIds ?? []),
        ]),
        destinationIds: unique([
            ...actionability.readiness.backedIds.webhookDestinationIds,
            ...activeAlerts.flatMap(alert => [...(alert.webhookDestinationIds ?? []), ...(alert.deliveryReadinessContext?.webhookDestinationIds ?? [])]),
        ]),
        casePaths: unique([
            ...activeAlerts.flatMap(alert => [alert.casePath, alert.deliveryReadinessContext?.casePath]),
            ...(caseOwnership?.sourceRefs.casePaths ?? []),
        ].filter((value): value is string => Boolean(value))),
        sourceIds: unique([
            ...selectedSourceIds,
            ...actionability.sourceProvenance.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
        ]),
    }
    const blockers = unique([
        ...actionability.webhookDeliveryHandoff.missing,
        ...actionability.actionPayloads.payloads.webhookDelivery.blockedBy.map(blocker => blocker.detail),
        ...alertRows.flatMap(alert => alert.blockers),
        ...(deliveryStage?.missing ?? []),
        ...(deliveryStage && deliveryStage.state === 'blocked' ? [deliveryStage.detail] : []),
    ]).slice(0, 10)
    const ready = actionability.webhookDeliveryHandoff.ready
        && actionability.actionPayloads.payloads.webhookDelivery.ready
        && deliveryStage?.state === 'ready'
        && alertRows.some(alert => alert.ready)
        && sourceRefs.destinationIds.length > 0
        && blockers.length === 0
    const state: SelectedDeliveryReadinessPlan['state'] = ready ? 'ready' : blockers.length || alertRows.some(alert => !alert.ready) ? 'blocked' : 'review'
    const route = actionability.webhookDeliveryHandoff.backedRoute
        || actionability.actionPayloads.payloads.webhookDelivery.backedRoute
        || actionability.webhookDeliveryHandoff.endpoint
    return {
        schemaVersion: 'ti.public_actor.selected_delivery_readiness.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        state,
        route,
        nextAction: ready
            ? 'Open the authenticated delivery action with this alert, capture, destination, and case link context.'
            : blockers.length ? `Resolve ${displayRequirementList(blockers.slice(0, 2))} before delivery review.` : 'Review the selected alert and choose an authenticated destination.',
        summary: {
            alerts: alertRows.length,
            captures: sourceRefs.captureIds.length,
            destinations: sourceRefs.destinationIds.length,
            caseRoutes: sourceRefs.casePaths.length,
            blockers: blockers.length,
        },
        alerts: alertRows,
        handoff: {
            ready,
            endpoint: actionability.webhookDeliveryHandoff.endpoint,
            route,
            missing: actionability.webhookDeliveryHandoff.missing,
            request: deliveryStage?.request ? consumerRequestActionLabel(deliveryStage.request.method, deliveryStage.request.path) : undefined,
        },
        sourceRefs,
        blockers,
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

export function deliveryBlockerLabel(value: string) {
    if (value === 'missing_capture_evidence') return 'Capture evidence is required before delivery review.'
    if (value === 'case_route_unavailable') return 'Case link is required before delivery review.'
    if (value === 'delivery_disabled') return 'Active destination is required before delivery review.'
    if (value === 'entitlement_denied') return 'Organization entitlement must allow delivery review.'
    return formatLabel(value)
}
