import crypto from 'node:crypto'
import type { DwmAlertEventType, DwmWebhookDestinationRow } from '../webhookDestinationTypes.ts'
import { clean, recordOrEmpty } from '../webhookValueUtils.ts'
import { normalizeAlert, normalizeWatchlist } from '../webhookAlertNormalization.ts'
import { buildIdempotencyKey, truncate } from '../webhookDeliveryUtilities.ts'
import { validateOutboundThirdPartyReport } from '../thirdPartyReport.ts'
import { DISCORD_CONTENT_LIMIT, DISCORD_EMBED_DESCRIPTION_LIMIT, DISCORD_EMBED_FIELD_LIMIT, DISCORD_EMBED_FIELD_NAME_LIMIT, DISCORD_EMBED_FIELD_VALUE_LIMIT, DISCORD_EMBED_FOOTER_TEXT_LIMIT, DISCORD_EMBED_TITLE_LIMIT } from './discordPayloadLimits.ts'
import { buildDwmDiscordPayloadTemplateProof, matchReasonSummary, workflowSummary } from './discordTemplate.ts'

export function buildDwmAlertDeliveryPayload({
    destination,
    alert,
    eventType,
    deliveryId = crypto.randomUUID(),
}: {
    destination: Pick<DwmWebhookDestinationRow, 'id' | 'kind' | 'name' | 'org_id'>
    alert: Record<string, unknown>
    eventType: DwmAlertEventType
    deliveryId?: string
}) {
    const reportValidation = alert.report === undefined ? undefined : validateOutboundThirdPartyReport(alert.report)
    if (reportValidation && !reportValidation.valid) throw new Error(`Invalid outbound third-party report: ${reportValidation.error}`)
    const report = reportValidation?.report
    const normalizedAlert = normalizeAlert(alert)
    const watchlist = normalizeWatchlist(alert.watchlist)
    const idempotencyKey = buildIdempotencyKey(eventType, destination.org_id, destination.id, normalizedAlert.dedupeKey || normalizedAlert.id)
    const displayDedupeKey = normalizedAlert.dedupeKey || idempotencyKey
    const analystLink = normalizedAlert.alertUrl || normalizedAlert.casePath
    const matchReason = matchReasonSummary(normalizedAlert)
    const alertContext = {
        ...normalizedAlert,
        matchReason,
    }
    const discordTemplate = buildDwmDiscordPayloadTemplateProof({
        eventType,
        normalizedAlert: alertContext,
        watchlist,
        analystLink,
        idempotencyKey,
    })
    const context = {
        schemaVersion: 'dwm.webhook.v1',
        eventType,
        occurredAt: normalizedAlert.eventTimestamp,
        discordTemplate,
        idempotencyKey,
        org: {
            id: destination.org_id,
            name: clean(alert.orgName) || clean(alert.organizationName) || destination.org_id,
            tenantId: normalizedAlert.tenantId,
        },
        destination: {
            id: destination.id,
            name: destination.name,
            kind: destination.kind,
        },
        report,
        alert: alertContext,
        watchlist,
        delivery: {
            id: deliveryId,
            replay: eventType === 'dwm.alert.replayed',
            eventType,
            dryRunDefault: true,
            route: normalizedAlert.route,
            casePath: normalizedAlert.casePath,
            alertUrl: normalizedAlert.alertUrl,
            caseActionId: normalizedAlert.caseActionId,
            caseActionPath: normalizedAlert.caseActionPath,
            analystLink,
            deliveryState: normalizedAlert.deliveryState,
            dedupeKey: displayDedupeKey,
            replayCount: normalizedAlert.replayCount,
            workflowState: normalizedAlert.workflowState,
        },
        source: {
            family: normalizedAlert.sourceFamily,
            artifactType: normalizedAlert.artifactType,
            provenanceSummary: normalizedAlert.provenanceSummary,
            confidence: normalizedAlert.confidence,
        },
    }

    if (destination.kind !== 'discord') {
        return context
    }

    return {
        content: discordText(`${severityEmoji(normalizedAlert.severity)} ${normalizedAlert.title}`, DISCORD_CONTENT_LIMIT),
        allowed_mentions: { parse: [] },
        embeds: [
            {
                title: discordText(normalizedAlert.title, DISCORD_EMBED_TITLE_LIMIT),
                description: discordText(normalizedAlert.claimSummary, DISCORD_EMBED_DESCRIPTION_LIMIT),
                color: severityColor(normalizedAlert.severity),
                timestamp: normalizedAlert.eventTimestamp || normalizedAlert.firstSeenAt || context.occurredAt,
                fields: [
                    discordField('Organization', context.org.name, true),
                    discordField('Severity', normalizedAlert.severity.toUpperCase(), true),
                    discordField('Company / domain', normalizedAlert.companyOrDomain || normalizedAlert.matchedTerm.value || 'Not provided', true),
                    discordField('Match reason', matchReason, false),
                    discordField('Observed at', normalizedAlert.eventTimestamp, true),
                    watchlist.name || watchlist.terms.length ? discordField('Watchlist', [watchlist.name, watchlist.terms[0]].filter(Boolean).join(' | '), true) : null,
                    discordField('Source family', normalizedAlert.sourceFamily || 'Unknown', true),
                    normalizedAlert.confidence.label ? discordField('Confidence', [normalizedAlert.confidence.label, normalizedAlert.confidence.reason].filter(Boolean).join(' | '), true) : null,
                    discordField('Evidence count', String(normalizedAlert.evidenceCount), true),
                    report ? discordField('Report', `${clean(recordOrEmpty(report.reportPolicy).format)} · ${clean(report.exportChecksum)}`, false) : null,
                    discordField('Evidence timestamp', normalizedAlert.evidenceTimestamp, true),
                    normalizedAlert.evidenceSummary ? discordField('Evidence summary', normalizedAlert.evidenceSummary, false) : null,
                    discordField('Route', normalizedAlert.route, true),
                    discordField('Workflow', workflowSummary(normalizedAlert, eventType), false),
                    discordField('Delivery state', normalizedAlert.deliveryState, true),
                    discordField('Dedupe key', displayDedupeKey, false),
                    normalizedAlert.caseId ? discordField('Case ID', normalizedAlert.caseId, true) : null,
                    normalizedAlert.casePath ? discordField('Case', normalizedAlert.casePath, false) : null,
                    normalizedAlert.caseActionPath ? discordField('Case action', normalizedAlert.caseActionPath, false) : null,
                    normalizedAlert.alertUrl ? discordField('Alert URL', normalizedAlert.alertUrl, false) : null,
                    analystLink ? discordField('Analyst link', analystLink, false) : null,
                    normalizedAlert.provenanceSummary ? discordField('Provenance', normalizedAlert.provenanceSummary, false) : null,
                    discordField('Recommended action', normalizedAlert.recommendedAction, false),
                ].filter(Boolean).slice(0, DISCORD_EMBED_FIELD_LIMIT),
                footer: {
                    text: discordText(`Hanasand DWM ${eventType.replace('dwm.alert.', '')} | ${normalizedAlert.id} | ${watchlist.id || 'no-watchlist'}`, DISCORD_EMBED_FOOTER_TEXT_LIMIT),
                },
            },
        ],
        _hanasand: context,
    }
}

function discordField(name: string, value: string, inline: boolean) {
    return {
        name: discordText(name, DISCORD_EMBED_FIELD_NAME_LIMIT),
        value: discordText(value || 'Not provided', DISCORD_EMBED_FIELD_VALUE_LIMIT),
        inline,
    }
}

function discordText(value: string, max: number) {
    const text = clean(value) || 'Not provided'
    return truncate(text, max)
}

function severityColor(severity: string) {
    if (severity === 'critical') return 0xDC2626
    if (severity === 'high') return 0xEA580C
    if (severity === 'medium') return 0xD97706
    if (severity === 'low') return 0x2563EB
    return 0x475467
}

function severityEmoji(severity: string) {
    if (severity === 'critical') return '[CRITICAL]'
    if (severity === 'high') return '[HIGH]'
    if (severity === 'medium') return '[MEDIUM]'
    if (severity === 'low') return '[LOW]'
    return '[INFO]'
}

