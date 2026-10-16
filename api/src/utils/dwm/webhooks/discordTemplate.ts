import type { DwmAlertEventType } from '../webhookDestinationTypes.ts'
import { clean } from '../webhookValueUtils.ts'
import { truncate } from '../webhookDeliveryUtilities.ts'
import type { normalizeAlert, normalizeWatchlist } from '../webhookAlertNormalization.ts'
import { DISCORD_CONTENT_LIMIT, DISCORD_EMBED_DESCRIPTION_LIMIT, DISCORD_EMBED_FIELD_LIMIT, DISCORD_EMBED_FIELD_NAME_LIMIT, DISCORD_EMBED_FIELD_VALUE_LIMIT, DISCORD_EMBED_TITLE_LIMIT } from './discordPayloadLimits.ts'

export function buildDwmDiscordPayloadTemplateProof({
    eventType,
    normalizedAlert,
    watchlist,
    analystLink,
    idempotencyKey,
}: {
    eventType: DwmAlertEventType
    normalizedAlert: ReturnType<typeof normalizeAlert>
    watchlist: ReturnType<typeof normalizeWatchlist>
    analystLink: string
    idempotencyKey: string
}) {
    const templateId = eventType === 'dwm.alert.replayed'
        ? 'dwm.discord.alert_replay.v1'
        : eventType === 'dwm.alert.updated'
            ? 'dwm.discord.alert_update.v1'
            : eventType === 'dwm.alert.test'
                ? 'dwm.discord.destination_test.v1'
                : 'dwm.discord.alert_created.v1'
    const requiredFields = [
        'Organization',
        'Severity',
        'Company / domain',
        'Match reason',
        'Observed at',
        'Watchlist',
        'Source family',
        'Evidence count',
        'Evidence timestamp',
        'Workflow',
        'Delivery state',
        'Dedupe key',
    ]
    const requiredPresence = {
        organization: true,
        severity: Boolean(normalizedAlert.severity),
        title: Boolean(normalizedAlert.title),
        companyOrDomain: Boolean(normalizedAlert.companyOrDomain || normalizedAlert.matchedTerm.value),
        matchReason: Boolean(matchReasonSummary(normalizedAlert)),
        observedAt: Boolean(normalizedAlert.eventTimestamp || normalizedAlert.firstSeenAt),
        watchlist: Boolean(watchlist.name || watchlist.terms.length || watchlist.id),
        sourceFamily: Boolean(normalizedAlert.sourceFamily),
        evidence: normalizedAlert.evidenceCount > 0,
        evidenceTimestamp: Boolean(normalizedAlert.evidenceTimestamp),
        workflow: Boolean(eventType),
        deliveryState: Boolean(normalizedAlert.deliveryState),
        dedupeKey: Boolean(normalizedAlert.dedupeKey || idempotencyKey),
        analystLink: Boolean(analystLink),
    }
    const missing = Object.entries(requiredPresence)
        .filter(([, present]) => !present)
        .map(([field]) => field)

    return {
        schemaVersion: 'dwm.webhook.discord_payload_template.v1',
        templateId,
        eventType,
        requiredFields,
        optionalFields: ['Confidence', 'Evidence summary', 'Case ID', 'Case', 'Case action', 'Alert URL', 'Analyst link', 'Provenance', 'Recommended action'],
        fieldOrder: [
            'Organization',
            'Severity',
            'Company / domain',
            'Match reason',
            'Observed at',
            'Watchlist',
            'Source family',
            'Confidence',
            'Evidence count',
            'Evidence timestamp',
            'Evidence summary',
            'Route',
            'Workflow',
            'Delivery state',
            'Dedupe key',
            'Case ID',
            'Case',
            'Case action',
            'Alert URL',
            'Analyst link',
            'Provenance',
            'Recommended action',
        ],
        requiredPresence,
        missing,
        ready: missing.length === 0,
        workflow: {
            replay: eventType === 'dwm.alert.replayed',
            update: eventType === 'dwm.alert.updated',
            test: eventType === 'dwm.alert.test',
            dryRunDefault: true,
        },
        limits: {
            content: DISCORD_CONTENT_LIMIT,
            title: DISCORD_EMBED_TITLE_LIMIT,
            description: DISCORD_EMBED_DESCRIPTION_LIMIT,
            fields: DISCORD_EMBED_FIELD_LIMIT,
            fieldName: DISCORD_EMBED_FIELD_NAME_LIMIT,
            fieldValue: DISCORD_EMBED_FIELD_VALUE_LIMIT,
        },
        noNetworkDefault: true,
        redaction: {
            safeForCustomerDisplay: true,
            endpointExposed: false,
            webhookSecretExposed: false,
            mentionsDisabled: true,
        },
    }
}

export function matchReasonSummary(alert: ReturnType<typeof normalizeAlert>) {
    const term = clean(alert.matchedTerm.value)
    const kind = clean(alert.matchedTerm.kind)
    const confidenceReason = clean(alert.confidence.reason)
    const evidenceLead = alert.evidence[0]
    const evidenceContext = evidenceLead
        ? [evidenceLead.label, evidenceLead.source || evidenceLead.capturedAt].filter(Boolean).join(' | ')
        : ''
    const parts = [
        term ? `${kind && kind !== 'unknown' ? kind : 'term'} match: ${term}` : '',
        confidenceReason,
        evidenceContext,
    ].filter(Boolean)
    return truncate(parts.join(' | ') || alert.companyOrDomain || 'Matched watchlist evidence', DISCORD_EMBED_FIELD_VALUE_LIMIT)
}

export function workflowSummary(alert: ReturnType<typeof normalizeAlert>, eventType: DwmAlertEventType) {
    const parts = [
        eventType.replace('dwm.alert.', ''),
        `review ${alert.reviewState}`,
        `delivery ${alert.deliveryState}`,
        alert.replayCount ? `replay ${alert.replayCount}` : '',
    ].filter(Boolean)
    return parts.join(' | ')
}
