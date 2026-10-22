import { redactSecretBearingText, type DiscordEmbed } from './discordWebhookFile.ts'
import { readableMonitoringMessage } from '../monitoringMessage.ts'

type CaseDetails = {
    kind: string
    summary: string
    occurrences: number
    first_seen_at: string | Date
    last_seen_at: string | Date
    resolved_at?: string | Date | null
    severity_override?: string | null
    status_override?: string | null
}

function discordTimestamp(value: string | Date) {
    const seconds = Math.floor(new Date(value).getTime() / 1000)
    return Number.isFinite(seconds) ? `<t:${seconds}:f>` : 'Unknown'
}

function severityColor(severity: string) {
    if (severity === 'critical' || severity === 'high') return 0xED4245
    if (severity === 'medium') return 0xFEE75C
    return 0x5865F2
}

export function monitoringCaseDiscordAlert(caseId: string, monitorName: string, automationId: string, issue: CaseDetails, organizationId?: string | null, context: { targetUrl?: string | null } = {}) {
    const organizationScope = organizationId ? `org=${encodeURIComponent(organizationId)}` : ''
    const url = `https://hanasand.com/cases/${encodeURIComponent(caseId)}${organizationScope ? `?${organizationScope}` : ''}`
    const severity = issue.severity_override || (issue.kind === 'failure' ? 'high' : 'medium')
    const embed: DiscordEmbed = {
        title: redactSecretBearingText(`${caseId} · ${monitorName}`).slice(0, 256),
        url,
        description: redactSecretBearingText(readableMonitoringMessage(issue.summary, { monitorName, targetUrl: context.targetUrl })).slice(0, 3000),
        color: severityColor(severity),
        fields: [
            { name: 'Severity', value: severity, inline: true },
            { name: 'Case status', value: issue.status_override || (issue.resolved_at ? 'resolved' : 'open'), inline: true },
            { name: 'Occurrences', value: String(issue.occurrences), inline: true },
            { name: 'First seen', value: discordTimestamp(issue.first_seen_at), inline: true },
            { name: 'Last seen', value: discordTimestamp(issue.last_seen_at), inline: true },
            { name: 'Health check', value: `[View health check](https://hanasand.com/automation/health?monitor=${encodeURIComponent(automationId)}${organizationScope ? `&${organizationScope}` : ''})` },
        ],
    }
    return { content: `[${caseId}](${url})`, embeds: [embed] }
}
