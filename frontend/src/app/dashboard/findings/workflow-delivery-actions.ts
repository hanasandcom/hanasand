import { durableDeliveryRows } from './workflow-values'
import { postJson } from './workflow-http'
import type { WorkflowActionContext } from './workflow-action-context'
import { runWorkflowAction } from './workflow-action-lifecycle'

export function createDeliveryActions(context: WorkflowActionContext, effectiveTermCount: number, onRefresh: () => void) {
    const { scope, webhookUrl, setResult, setLastRoute } = context

    async function deliverWebhooks() {
        await runWorkflowAction(context, 'delivery', async () => {
            const delivery = await postJson('/api/findings/webhooks/deliver', {
                ...scope, limit: 25, webhookUrl: context.webhookConfigured ? webhookUrl.trim() : undefined,
            })
            if (!delivery.ok) throw new Error(delivery.message)
            const rows = durableDeliveryRows(delivery)
            if (!rows.length) throw new Error('No durable delivery result was returned.')
            const failed = rows.some(row => row.status === 'failed' || Boolean(row.error))
            const deliveredCount = rows.filter(row => row.status === 'delivered' && row.dryRun !== true).length
            const dryRunCount = rows.filter(row => row.status === 'dry_run' || row.dryRun === true).length
            const skippedCount = rows.filter(row => row.status === 'skipped').length
            const message = failed
                ? 'Webhook delivery recorded a failed attempt. Review delivery history before retrying.'
                : deliveredCount
                    ? `${deliveredCount} event${deliveredCount === 1 ? '' : 's'} delivered to the configured destination.`
                    : dryRunCount
                        ? 'Webhook delivery recorded a dry-run; no customer notification was sent.'
                        : skippedCount
                            ? 'Webhook delivery was skipped; no customer notification was sent.'
                            : 'No delivered customer notification was recorded.'
            setResult({ ok: !failed && deliveredCount > 0, message })
            setLastRoute({ label: 'Webhook delivery', watchTerms: effectiveTermCount, deliveryAttempts: rows.length, deliveryState: failed ? 'failed' : deliveredCount ? 'delivered' : dryRunCount ? 'dry-run recorded' : skippedCount ? 'skipped' : 'no delivery' })
            onRefresh()
        })
    }

    async function testWebhook() {
        await runWorkflowAction(context, 'webhook-test', async () => {
            const test = await postJson('/api/findings/webhooks/test', { ...scope, webhookUrl: webhookUrl.trim() || undefined })
            if (!test.ok) throw new Error(test.message)
            const rows = durableDeliveryRows(test)
            if (!rows.length) throw new Error('No durable delivery result was returned.')
            const failed = rows.some(row => row.status === 'failed' || Boolean(row.error))
            const dryRun = rows.some(row => row.status === 'dry_run' || row.dryRun === true)
            setResult({ ok: !failed && !dryRun, message: failed
                ? 'Webhook test recorded a failed delivery attempt. Review delivery history before retrying.'
                : dryRun ? 'Webhook test recorded a dry-run delivery. Future events can use this destination.'
                    : 'Webhook test delivered. Future events can use this destination.' })
            setLastRoute({ label: 'Webhook test', watchTerms: effectiveTermCount, deliveryAttempts: rows.length, deliveryState: failed ? 'test failed' : dryRun ? 'test recorded' : 'test delivered' })
            onRefresh()
        })
    }

    return { deliverWebhooks, testWebhook }
}
