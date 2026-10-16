import { useState, type Dispatch, type SetStateAction } from 'react'
import type { PortalAlert, DeliveryItem } from './types'
import { alertOrganizationId, scopeBody } from './portal-data'
import { deliveryActionMessage, mergeDeliveries, readPayload } from './delivery-messages'

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
            const response = await fetch('/api/findings/webhooks/deliver', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopeBody({ alertId, limit: 1 }, tenantId, alert ? alertOrganizationId(alert, organizationId) : organizationId)),
            })
            const payload = await readPayload(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return deliveryActionMessage(upsertDeliveryRows(payload.deliveries ?? (payload.delivery ? [payload.delivery] : [])), 'Webhook delivery')
        })
    }

    async function testDelivery(alertId: string) {
        await runAction(`test:${alertId}`, async () => {
            const alert = alerts.find(item => item.id === alertId)
            const response = await fetch('/api/findings/webhooks/test', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopeBody({ alertId, limit: 1 }, tenantId, alert ? alertOrganizationId(alert, organizationId) : organizationId)),
            })
            const payload = await readPayload(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return deliveryActionMessage(upsertDeliveryRows(payload.deliveries ?? (payload.delivery ? [payload.delivery] : [])), 'Webhook test')
        })
    }

    return { busyAction, actionMessage, sendAlert, testDelivery }
}
