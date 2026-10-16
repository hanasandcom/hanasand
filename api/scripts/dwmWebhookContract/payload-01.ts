import { webhooks, context as ctx, expect } from './runtime.ts'
const { buildDwmAlertDeliveryPayload, normalizeDwmWebhookDestinationInput } = webhooks

const secret = ctx.secret = 'discord-secret-contract-test'
const endpoint = ctx.endpoint = `https://discord.com/api/webhooks/987654321/${secret}`

const destination = ctx.destination = normalizeDwmWebhookDestinationInput({
    orgId: 'org_contract',
    name: 'Customer Discord',
    endpointUrl: endpoint,
    events: ['dwm.alert.created', 'dwm.alert.replayed'],
}, 'owner_contract')

expect(destination.kind === 'discord', 'Discord endpoint should infer discord destination kind.', destination)
expect(destination.endpointHint === 'https://discord.com/api/webhooks/987654321/...', 'Endpoint hint should redact Discord secret.', destination)
expect(destination.endpointHash?.startsWith('endpoint_'), 'Endpoint hash should be generated.', destination)
try {
    normalizeDwmWebhookDestinationInput({ endpointUrl: 'http://hooks.example.com/dwm' }, 'owner_contract')
    throw new Error('Expected HTTP webhook URL to be rejected.')
} catch (error) {
    expect(error instanceof Error && error.message.includes('HTTPS'), 'Invalid URL error should explain HTTPS requirement.', error)
}

const payload = ctx.payload = buildDwmAlertDeliveryPayload({
    destination: {
        id: 'destination_contract',
        kind: 'discord',
        name: 'Customer Discord',
        org_id: 'org_contract',
    },
    eventType: 'dwm.alert.replayed',
    deliveryId: 'delivery_contract',
    alert: {
        id: 'alert_contract',
        title: 'Critical Acme domain exposure',
        severity: 'critical',
        company: 'Acme Security',
        domain: 'acme-security.com',
        sourceFamily: 'ransomware_leak_site',
        claimSummary: 'A leak-site post references Acme Security domain assets.',
        recommendedAction: 'Validate source provenance and notify the customer owner.',
        tenantId: 'tenant_contract',
        confidenceScore: 0.91,
        confidenceReason: 'Domain and company matched across two independent captures.',
        deliveryState: 'retry_scheduled',
        createdAt: '2026-06-28T09:15:00.000Z',
        matchedTerm: { value: 'acme-security.com', kind: 'domain' },
        evidence: [
            { label: 'Victim claim', detail: 'Public leak-site metadata matched the watched domain.', capturedAt: '2026-06-28T08:58:00.000Z' },
            { label: 'Telegram mention', detail: 'Public channel echoed the same domain.', capturedAt: '2026-06-28T09:02:00.000Z' },
        ],
        dedupeKey: 'dwm_dedupe_acme_contract',
        route: 'customer_discord',
        casePath: '/dwm?alert=alert_contract',
        alertUrl: 'https://app.hanasand.local/dwm?alert=alert_contract',
        caseId: 'case_contract',
        caseActionId: 'case_action_contract',
        caseActionPath: '/dwm/cases/case_contract/actions/case_action_contract',
        provenance: { captureIds: ['capture_contract'], sourceIds: ['source_contract'], primaryCaptureId: 'capture_contract' },
        watchlist: {
            id: 'watchlist_contract',
            name: 'Acme watchlist',
            terms: ['acme-security.com'],
        },
    },
}) as Record<string, unknown>

const serialized = ctx.serialized = JSON.stringify(payload)
const payloadContext = ctx.payloadContext = payload._hanasand as Record<string, unknown>
const payloadTemplate = ctx.payloadTemplate = payloadContext.discordTemplate as Record<string, unknown>
const payloadEmbed = ctx.payloadEmbed = (payload.embeds as Array<Record<string, unknown>>)[0]
const payloadFields = ctx.payloadFields = payloadEmbed.fields as Array<Record<string, unknown>>
expect(Array.isArray(payload.embeds), 'Discord payload should include embeds.', payload)
expect(serialized.includes('Critical Acme domain exposure'), 'Payload should include alert title.', payload)
expect(serialized.includes('CRITICAL'), 'Payload should include severity.', payload)
expect(payloadContext.occurredAt === '2026-06-28T09:15:00.000Z' && payloadEmbed.timestamp === '2026-06-28T09:15:00.000Z', 'Payload should preserve real alert event timestamp.', payload)
expect(payloadFields.some(field => field.name === 'Observed at' && field.value === '2026-06-28T09:15:00.000Z'), 'Discord payload should include an operator-readable observed timestamp field.', payloadFields)
expect(payloadFields.some(field => field.name === 'Delivery state' && field.value === 'retry_scheduled'), 'Discord payload should expose the next delivery state.', payloadFields)
expect(payloadFields.some(field => field.name === 'Match reason' && String(field.value).includes('domain match: acme-security.com') && String(field.value).includes('two independent captures')), 'Discord payload should explain why the alert matched.', payloadFields)
expect(payloadFields.some(field => field.name === 'Evidence timestamp' && field.value === '2026-06-28T08:58:00.000Z'), 'Discord payload should include the evidence capture timestamp.', payloadFields)
expect(payloadFields.some(field => field.name === 'Company / domain' && field.value === 'Acme Security'), 'Payload should include company context in the Company / domain field.', payloadFields)
expect(serialized.includes('ransomware_leak_site'), 'Payload should include source family.', payload)
expect(serialized.includes('Confidence') && serialized.includes('91%'), 'Payload should include confidence context.', payload)
expect(serialized.includes('Evidence count'), 'Payload should include evidence count field.', payload)
expect(serialized.includes('Acme watchlist') && serialized.includes('acme-security.com'), 'Payload should include watchlist context.', payload)
expect(serialized.includes('customer_discord'), 'Payload should include route.', payload)
expect(serialized.includes('dwm.alert.replayed:org_contract:destination_contract:dwm_dedupe_acme_contract'), 'Payload should include destination idempotency key.', payload)
expect(serialized.includes('case_contract'), 'Payload should include case id.', payload)
expect(payloadFields.some(field => field.name === 'Case action' && field.value === '/dwm/cases/case_contract/actions/case_action_contract'), 'Payload should include case action replay path.', payloadFields)
expect(serialized.includes('Alert URL') && serialized.includes('https://app.hanasand.local/dwm?alert=alert_contract'), 'Payload should include alert URL/deep link.', payload)
expect(serialized.includes('Analyst link') && ((payloadContext.delivery as Record<string, unknown>).analystLink === 'https://app.hanasand.local/dwm?alert=alert_contract'), 'Payload should include a single analyst action/deep link.', payload)
expect(serialized.includes('capture_contract') && serialized.includes('source_contract'), 'Payload should include provenance summary.', payload)
expect(serialized.includes('Workflow') && serialized.includes('replayed') && serialized.includes('tenant_contract'), 'Payload should include workflow and tenant routing context.', payload)
expect(payloadTemplate.schemaVersion === 'dwm.webhook.discord_payload_template.v1' && payloadTemplate.templateId === 'dwm.discord.alert_replay.v1' && payloadTemplate.ready === true, 'Discord payload should include a ready replay template contract.', payloadTemplate)
expect(Array.isArray(payloadTemplate.requiredFields) && payloadTemplate.requiredFields.includes('Watchlist') && payloadTemplate.requiredFields.includes('Dedupe key') && payloadTemplate.requiredFields.includes('Delivery state') && payloadTemplate.requiredFields.includes('Match reason') && payloadTemplate.requiredFields.includes('Evidence timestamp'), 'Discord template should declare customer-useful required fields.', payloadTemplate)
expect((payloadTemplate.redaction as Record<string, unknown>)?.webhookSecretExposed === false && payloadTemplate.noNetworkDefault === true, 'Discord template should prove no-network redaction defaults.', payloadTemplate)

const longDiscordPayload = ctx.longDiscordPayload = buildDwmAlertDeliveryPayload({
    destination: {
        id: 'destination_long_contract',
        kind: 'discord',
        name: 'Long Discord',
        org_id: 'org_contract',
    },
    eventType: 'dwm.alert.created',
    deliveryId: 'delivery_long_contract',
    alert: {
        id: 'alert_long_contract',
        title: `Critical ${'title '.repeat(80)}`,
        severity: 'critical',
        company: 'Acme Security',
        sourceFamily: 'telegram_public',
        claimSummary: 'summary '.repeat(900),
        recommendedAction: 'action '.repeat(400),
        matchedTerm: { value: 'acme-security.com', kind: 'domain' },
        evidence: [
            { label: 'Long evidence label '.repeat(25), detail: 'evidence detail '.repeat(120) },
            { label: 'Second evidence', detail: 'secondary detail '.repeat(120) },
            { label: 'Third evidence', detail: 'tertiary detail '.repeat(120) },
        ],
        dedupeKey: 'dwm_dedupe_long_contract',
        route: 'customer_discord',
        casePath: '/dwm?alert=alert_long_contract',
        alertUrl: 'https://app.hanasand.local/dwm?alert=alert_long_contract&case=case_long_contract',
        watchlist: {
            id: 'watchlist_long_contract',
            name: 'Long watchlist',
            terms: ['acme-security.com'],
        },
    },
}) as Record<string, unknown>
const longContext = ctx.longContext = longDiscordPayload._hanasand as Record<string, unknown>
const longAlertContext = ctx.longAlertContext = longContext.alert as Record<string, unknown>
const longTemplate = ctx.longTemplate = longContext.discordTemplate as Record<string, unknown>

expect(JSON.stringify(longDiscordPayload).includes('Alert URL') && longAlertContext.alertUrl === 'https://app.hanasand.local/dwm?alert=alert_long_contract&case=case_long_contract', 'Long Discord payload should preserve alert deep link context.', longDiscordPayload)
expect((longTemplate.limits as Record<string, unknown>)?.fields === 25 && longTemplate.templateId === 'dwm.discord.alert_created.v1', 'Discord template should expose enforced Discord limits for created alerts.', longTemplate)
