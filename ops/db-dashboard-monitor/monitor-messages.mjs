import { backupStatusPath, baseUrl, dashboardPath, discordMention, failureScreenshotPath, now } from './monitor-config.mjs'
import { formatBytes } from './dashboard-signals.mjs'

export function buildDiscordPayload({ status, color, title, description, fields }) {
    const fieldMap = new Map((fields || []).map(field => [field.name, field.value]))
    const cause = fieldMap.get('Cause') || fieldMap.get('What failed') || reasonLabel(status)
    const action = fieldMap.get('Action') || fieldMap.get('Operator action') || 'Open the monitor evidence and rerun the check.'
    const evidence = fieldMap.get('Evidence') || fieldMap.get('URL') || `${baseUrl}${dashboardPath}`
    const screenshotUrl = fieldMap.get('Screenshot') || ''
    const impact = truncate(cleanSentence(description), 82)
    const actionText = truncate(cleanSentence(action), 56)
    const conciseContent = status === 'DOWN'
        ? `${discordMention} ${title}. ${impact} Next: ${actionText}.${screenshotUrl ? `\n${screenshotUrl}` : ''}`
        : undefined

    return {
        content: conciseContent,
        embeds: [{
            title,
            description: truncate(description, 500),
            color,
            timestamp: now.toISOString(),
            fields: [
                { name: 'Cause', value: truncate(cause, 220), inline: true },
                { name: 'Impact', value: truncate(description, 300), inline: false },
                { name: 'Action', value: truncate(action, 260), inline: false },
                { name: 'Evidence', value: truncate(evidence, 260), inline: false },
                ...(fields || []).filter(field => !['Cause', 'What failed', 'Action', 'Operator action', 'Evidence', 'URL', 'Screenshot'].includes(field.name)),
            ],
        }],
    }
}

export function resultFields(result, serviceAccountId = '') {
    const metrics = result.metrics || {}
    const screenshot = result.failureScreenshotUrl || failureScreenshotPath
    const backupFailure = String(result.reason || '').startsWith('ti_backup_')
    return [
        { name: 'Cause', value: reasonLabel(result.reason), inline: true },
        { name: 'Action', value: operatorAction(result.reason), inline: false },
        {
            name: 'Evidence',
            value: backupFailure
                ? `${backupStatusPath}\n/home/hanasand/hanasand/ops/monitoring-state/threat-intel-backup.log`
                : result.ok ? `${baseUrl}${dashboardPath}` : `${baseUrl}${dashboardPath}\nScreenshot: ${screenshot}`,
            inline: false,
        },
        ...(result.ok || !result.failureScreenshotUrl ? [] : [{ name: 'Screenshot', value: result.failureScreenshotUrl, inline: false }]),
        { name: 'Clusters', value: String(metrics.clusters ?? 'unknown'), inline: true },
        { name: 'Databases', value: String(metrics.databases ?? 'unknown'), inline: true },
        { name: 'Storage', value: metrics.storageBytes ? formatBytes(metrics.storageBytes) : 'unknown', inline: true },
        ...(metrics.backupStatus ? [{ name: 'TI backup', value: `${metrics.backupStatus}${metrics.backupFinishedAt ? ` · ${metrics.backupFinishedAt}` : ''}`, inline: true }] : []),
        { name: 'Latency', value: `${result.latencyMs}ms`, inline: true },
        { name: 'Service account', value: serviceAccountId || 'Database UI monitor', inline: true },
    ]
}

export function reasonLabel(reason) {
    return String(reason || 'monitor failure').replace(/^db_dashboard_/, '').replace(/^ti_backup_/, 'TI backup ').replace(/_/g, ' ')
}

export function failureImpact(reason) {
    if (reason === 'ti_backup_missing') return 'No threat-intelligence backup result is available.'
    if (reason === 'ti_backup_invalid') return 'The threat-intelligence backup result cannot be trusted.'
    if (reason === 'ti_backup_failed') return 'The latest threat-intelligence backup failed.'
    if (reason === 'ti_backup_stale') return 'No recent successful threat-intelligence backup is available.'
    if (reason === 'missing_credentials') return 'The monitor cannot sign in because credentials are not configured.'
    if (reason === 'db_dashboard_unavailable') return 'The dashboard rendered an unavailable or reconnecting telemetry state.'
    if (reason === 'db_dashboard_missing_clusters') return 'The dashboard did not show a PostgreSQL cluster.'
    if (reason === 'db_dashboard_missing_databases') return 'The dashboard did not show a database.'
    if (reason === 'db_dashboard_missing_storage') return 'The dashboard did not show non-zero storage telemetry.'
    if (reason === 'db_dashboard_missing_query_state') return 'The dashboard did not show query-health state.'
    return 'The monitor could not verify the database dashboard.'
}

export function operatorAction(reason) {
    if (String(reason || '').startsWith('ti_backup_')) return 'Open LATEST-STATUS and the threat-intelligence backup log, repair the failure, then rerun the backup.'
    if (reason === 'missing_credentials') return 'Restore HANASAND_DB_MONITOR_SERVICE_ACCOUNT_KEY, then run the monitor once.'
    if (reason === 'db_dashboard_unavailable') return 'Check API auth, PostgreSQL telemetry views, and the dashboard screenshot.'
    if (reason === 'db_dashboard_missing_clusters' || reason === 'db_dashboard_missing_databases' || reason === 'db_dashboard_missing_storage') return 'Check the database telemetry collector and dashboard API response.'
    if (reason === 'db_dashboard_missing_query_state') return 'Check the query telemetry block and dashboard render.'
    return 'Open the failure screenshot and rerun the monitor after the dependency is fixed.'
}

function truncate(value, max) {
    const text = String(value || '')
    return text.length > max ? `${text.slice(0, max - 1)}...` : text
}

function cleanSentence(value) {
    return String(value || '').replace(/\s+/g, ' ').replace(/[.\s]+$/g, '')
}
