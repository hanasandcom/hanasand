import { useState, type Dispatch, type SetStateAction } from 'react'
import type { PortalAlert, DeliveryItem } from './types'
import { alertOrganizationId, scopeBody } from './portal-data'
import { deliveryActionMessage, mergeDeliveries } from './delivery-messages'
import { postWebhookJson } from '../webhookDeliveryTransport'

type FindingsActionsInput = {
    tenantId: string
    organizationId?: string
    alerts: PortalAlert[]
    setLocalDeliveries: Dispatch<SetStateAction<DeliveryItem[]>>
    setRefreshVersion: Dispatch<SetStateAction<number>>
    refreshPage: () => void
}

export function useFindingsActions({ tenantId, organizationId, alerts, setLocalDeliveries, setRefreshVersion, refreshPage }: FindingsActionsInput) {
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [actionMessage, setActionMessage] = useState<{ ok: boolean, text: string } | null>(null)

    function upsertDeliveryRows(rows: DeliveryItem[]) {
        if (!rows.length) return []
        setLocalDeliveries(current => mergeDeliveries(rows, current))
        return rows
    }

    async function runAction(key: string, action: () => Promise<string>) {
        setBusyAction(key)
        setActionMessage(null)
        try {
            setActionMessage({ ok: true, text: await action() })
            setRefreshVersion(version => version + 1)
            refreshPage()
        } catch (error) {
            console.error('DWM action failed', error)
            setActionMessage({ ok: false, text: error instanceof Error ? error.message : 'The action failed. Try again.' })
        } finally {
            setBusyAction(null)
        }
    }

    async function sendAlert(alertId: string) {
        await runAction(`send:${alertId}`, async () => {
            const alert = alerts.find(item => item.id === alertId)
            const payload = await postWebhookJson<DeliveryActionPayload>('/api/findings/webhooks/deliver',
                scopeBody({ alertId, limit: 1 }, tenantId, alert ? alertOrganizationId(alert, organizationId) : organizationId))
            return deliveryActionMessage(upsertDeliveryRows(payload.deliveries ?? (payload.delivery ? [payload.delivery] : [])), 'Webhook delivery')
        })
    }

    async function testDelivery(alertId: string) {
        await runAction(`test:${alertId}`, async () => {
            const alert = alerts.find(item => item.id === alertId)
            const payload = await postWebhookJson<DeliveryActionPayload>('/api/findings/webhooks/test',
                scopeBody({ alertId, limit: 1 }, tenantId, alert ? alertOrganizationId(alert, organizationId) : organizationId))
            return deliveryActionMessage(upsertDeliveryRows(payload.deliveries ?? (payload.delivery ? [payload.delivery] : [])), 'Webhook test')
        })
    }

    return { busyAction, actionMessage, sendAlert, testDelivery }
}

type DeliveryActionPayload = {
    error?: { message?: string }
    delivery?: DeliveryItem
    deliveries?: DeliveryItem[]
}
