import type { AlertDetailState, CaseDetailState, OperatorActionRailRow, WorkbenchCase, WorkbenchDeliveryEvidence, WorkbenchOrgContext } from '../../types'
import { deliveryLedgerHref, hasSendDeliveryDestination, latestDeliveryForActionRail, organizationWebhookDestinationHref } from '../caseRoutes'
import { scopedDeliveryActionBody, sendDeliveryActionFor, sendDeliveryDisabledReason } from '../actionInputs'
import { stringValue } from '../actionMessages'

export function deliveryRows(selected: WorkbenchCase, orgContext?: WorkbenchOrgContext, caseDetail?: CaseDetailState, alertDetail?: AlertDetailState, actionDeliveries: WorkbenchDeliveryEvidence[] = []): OperatorActionRailRow[] {
    const rows: OperatorActionRailRow[] = []
    const activeWebhook = orgContext?.webhookDestinations.find(item => item.status === 'active')
    const sendAction = sendDeliveryActionFor(selected)
    if (sendAction) {
        const sendActionBody = scopedDeliveryActionBody(sendAction.body || {}, orgContext)
        const sendDestinationReady = hasSendDeliveryDestination({ ...sendAction, body: sendActionBody }, orgContext)
        const sendDisabledReason = sendDeliveryDisabledReason(selected, orgContext)
        rows.push({
            id: 'send_alert',
            label: 'Send delivery',
            detail: sendDestinationReady ? `Send to ${stringValue(sendActionBody.webhookDestinationId) || 'the selected destination'}.` : 'Configure or test an organization webhook destination before sending alert delivery.',
            tone: sendDisabledReason ? 'blocked' : selected.deliveryEvidence?.some(item => item.status === 'delivered') ? 'ready' : 'needs_action',
            action: sendDisabledReason ? { ...sendAction, body: sendActionBody, disabledReason: sendDisabledReason } : { ...sendAction, body: sendActionBody },
            disabledReason: sendDisabledReason,
        })
    }
    const selectedDelivery = latestDeliveryForActionRail(selected, caseDetail, actionDeliveries, orgContext)
    if (selectedDelivery) {
        const ledgerHref = deliveryLedgerHref(orgContext, selected, selectedDelivery)
        rows.push({
            id: 'open_delivery_ledger',
            label: 'Open delivery ledger',
            detail: `Open delivery ${selectedDelivery.id}:${selectedDelivery.status}.`,
            tone: selectedDelivery.status === 'failed' || selectedDelivery.status === 'skipped' ? 'blocked' : 'ready',
            href: ledgerHref,
        })
    } else if (selected.kind === 'dwm_alert' && alertDetail?.status === 'ready' && alertDetail.detail.deliveryReadiness?.deliveryHistoryRefs?.length) {
        const ledgerHref = deliveryLedgerHref(orgContext, selected)
        rows.push({
            id: 'inspect_alert_delivery_history',
            label: 'Delivery history',
            detail: `${alertDetail.detail.deliveryReadiness.deliveryHistoryRefs.length} delivery history reference${alertDetail.detail.deliveryReadiness.deliveryHistoryRefs.length === 1 ? '' : 's'} attached.`,
            tone: alertDetail.detail.deliveryReadiness.ready ? 'ready' : 'needs_action',
            href: ledgerHref,
        })
    }
    if (activeWebhook && orgContext?.organization) {
        const destinationHref = organizationWebhookDestinationHref(orgContext.organization.id, activeWebhook.id)
        rows.push({
            id: 'inspect_webhook_destination',
            label: 'Open destination',
            detail: `${activeWebhook.name} is ${activeWebhook.status}${activeWebhook.lastTestStatus ? `, last test ${activeWebhook.lastTestStatus}` : ''}.`,
            tone: activeWebhook.status === 'active' ? 'ready' : 'needs_action',
            href: destinationHref,
        })
        rows.push({
            id: 'test_webhook',
            label: 'Test webhook',
            detail: `${activeWebhook.name} (${activeWebhook.id}) via /api/organizations/:id/webhooks/test.`,
            tone: activeWebhook.lastTestStatus === 'failed' ? 'blocked' : 'ready',
            action: {
                id: 'test_org_webhook',
                label: 'Test',
                method: 'POST',
                href: `/api/organizations/${encodeURIComponent(orgContext.organization.id)}/webhooks/test`,
                body: { webhookDestinationId: activeWebhook.id, dryRun: true },
            },
        })
    } else {
        rows.push({ id: 'configure_webhook', label: 'Configure webhook', detail: 'Add an active organization destination before sending alerts.', tone: 'needs_action', href: '/automation?setup=dwm' })
    }
    if (selected.kind === 'webhook_readiness') {
        rows.push({
            id: 'inspect_webhook_delivery_history',
            label: 'Delivery history',
            detail: 'Delivery attempts for the selected organization or workspace.',
            tone: selected.deliveryEvidence?.length ? 'ready' : 'needs_action',
            href: deliveryLedgerHref(orgContext, selected),
        })
        rows.push({
            id: 'open_webhook_configuration',
            label: 'Delivery setup',
            detail: activeWebhook && orgContext?.organization ? 'Open the organization webhook route used by Test webhook and Send alerts.' : 'Open delivery setup before sending alerts.',
            tone: activeWebhook ? 'ready' : 'needs_action',
            href: orgContext?.organization ? `/api/organizations/${encodeURIComponent(orgContext.organization.id)}/webhooks` : '/automation?setup=dwm',
        })
    }
    return rows
}
