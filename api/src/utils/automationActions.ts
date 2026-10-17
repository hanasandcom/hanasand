import run from '#db'
import type { AutomationRow } from './automationTypes.ts'
import { runMonitoringCheck } from './automationMonitoring.ts'
import { deliverDiscordWebhookFile, discordWebhookFileModelLabel, redactSecretBearingText } from '#utils/alerts/discordWebhookFile.ts'
import { getMailHealth } from '#utils/mail/health.ts'
import { legacyNotificationDestinations } from './automationInputValues.ts'

export async function runAutomationAction(automation: AutomationRow) {
    if (automation.action_type === 'echo') {
        return {
            provider: 'hanasand-automation',
            model: 'echo',
            message: `Echo completed at ${new Date().toISOString()}: ${automation.prompt}`,
        }
    }

    if (automation.action_type === 'mail_health_check') {
        const health = await getMailHealth().catch(error => ({
            status: 'error' as const,
            checkedAt: new Date().toISOString(),
            queueDepth: 0,
            smtpBannerLatencyMs: null,
            checks: [{
                id: 'mail-overview',
                label: 'Mail overview',
                status: 'error' as const,
                detail: error instanceof Error ? redactSecretBearingText(error.message) : 'Mail health check failed.',
            }],
        }))
        const unhealthyChecks = health.checks.filter(check => check.status !== 'healthy')
        const summary = [
            `Mail health ${health.status} at ${health.checkedAt}.`,
            unhealthyChecks.length
                ? `Issues: ${unhealthyChecks.map(check => `${check.label}: ${check.detail}`).join('; ')}`
                : 'All checks are healthy.',
        ].join(' ')

        if (health.status !== 'healthy' || automation.notify_on === 'always') {
            await deliverDiscordIfConfigured(automation, `Hanasand mail alert: ${summary}`)
        }

        return {
            provider: 'hanasand-alerts',
            model: automation.model_name ? discordWebhookFileModelLabel(automation.model_name) : 'mail-health',
            message: summary,
        }
    }

    if (automation.action_type === 'system_alert') {
        await deliverDiscordIfConfigured(automation, `Hanasand alert: ${automation.prompt}`)
        return {
            provider: 'hanasand-alerts',
            model: automation.model_name ? discordWebhookFileModelLabel(automation.model_name) : 'system-alert',
            message: 'System alert delivered.',
        }
    }

    if (automation.action_type === 'organization_report') {
        const report = await buildOrganizationReport(automation)
        await deliverDiscordIfConfigured(automation, report)
        return {
            provider: 'hanasand-organization-report',
            model: automation.model_name ? discordWebhookFileModelLabel(automation.model_name) : 'organization-report',
            message: report,
        }
    }

    return runMonitoringCheck(automation)
}
async function deliverDiscordIfConfigured(automation: AutomationRow, content: string) {
    const destinations = automation.notification_destinations?.length ? automation.notification_destinations : legacyNotificationDestinations(automation.model_name)
    await Promise.all(destinations.map(destination => deliverDiscordWebhookFile(destination, content)))
}

async function buildOrganizationReport(automation: AutomationRow) {
    if (!automation.organization_id) throw new Error('Organization report is missing its organization scope.')
    const watchlists = await run(`
        SELECT value, kind
        FROM organization_watchlist_items
        WHERE organization_id = $1 AND status = 'active' AND archived_at IS NULL
        ORDER BY value ASC
    `, [automation.organization_id])
    const terms = (watchlists.rows as Array<{ value: string, kind: string }>).map(row => `${row.value} (${row.kind})`)
    const snapshot = await fetchOrganizationProduct(automation.organization_id)
    const alerts = Array.isArray(snapshot.alerts) ? snapshot.alerts : []
    const sourceCoverage = snapshot.sourceCoverage && typeof snapshot.sourceCoverage === 'object'
        ? Object.keys(snapshot.sourceCoverage as Record<string, unknown>).length
        : 0
    const readiness = snapshot.readiness && typeof snapshot.readiness === 'object'
        ? String((snapshot.readiness as Record<string, unknown>).decision || 'not reported')
        : 'not reported'
    const lines = [
        `Hanasand monitoring report · ${new Date().toISOString()}`,
        `Organization: ${automation.organization_id}`,
        `Active watchlist: ${terms.length ? terms.join(', ') : 'none configured'}`,
        `Observed alerts: ${alerts.length}`,
        `Source coverage groups: ${sourceCoverage}`,
        `Readiness: ${readiness}`,
    ]
    if (alerts.length) {
        const preview = alerts.slice(0, 5).map((alert: any) => `${alert.severity || 'unknown'} · ${alert.company || alert.matchedTerm?.value || 'match'} · ${alert.reviewState || 'review'}`)
        lines.push(`Alert queue: ${preview.join(' | ')}`)
        if (alerts.length > preview.length) lines.push(`Alert queue: +${alerts.length - preview.length} more; review in DWM.`)
    } else {
        lines.push('Alert queue: no scoped matches in this snapshot.')
    }
    lines.push(`Instructions: ${automation.prompt}`)
    return lines.join('\n')
}

async function fetchOrganizationProduct(organizationId: string) {
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    const token = process.env.TI_SCRAPER_SERVICE_TOKEN
    if (!base || !token) throw new Error('Threat-intelligence report runtime is not configured.')
    const url = new URL(`${base}/v1/dwm/product`)
    url.searchParams.set('organizationId', organizationId)
    const response = await fetch(url, {
        headers: {
            accept: 'application/json',
            'x-hanasand-service-token': token,
            'x-organization-id': organizationId,
            'x-tenant-id': organizationId,
        },
        signal: AbortSignal.timeout(30_000),
    })
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok || !payload) throw new Error(`Threat-intelligence report returned ${response.status}.`)
    return payload
}
