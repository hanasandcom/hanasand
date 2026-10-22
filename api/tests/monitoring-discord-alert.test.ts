import { afterAll, afterEach, expect, spyOn, test } from 'bun:test'
import { monitoringCaseDiscordAlert } from '../src/utils/alerts/monitoringCase.ts'
import { deliverDiscordWebhookFile } from '../src/utils/alerts/discordWebhookFile.ts'

const issue = { kind: 'failure', summary: 'GPU usage is high: 81% used (alert at 80%).', occurrences: 3, first_seen_at: '2026-09-07T18:11:00Z', last_seen_at: '2026-09-07T18:13:00Z' }
const requests: Array<{ url: string, body: Record<string, any> }> = []
const fetchMock = spyOn(globalThis, 'fetch')
afterAll(() => fetchMock.mockRestore())
afterEach(() => { fetchMock.mockReset(); requests.length = 0 })

function interceptDelivery() {
    fetchMock.mockImplementation(async (url, options) => {
        requests.push({ url: String(url), body: JSON.parse(String(options?.body)) })
        return new Response(JSON.stringify({ id: 'receipt', mention_everyone: true }), { status: 200 })
    })
}

test('one webhook message combines the ping, clickable case and diagnostic embed', async () => {
    interceptDelivery()
    const alert = monitoringCaseDiscordAlert('HA-9050', 'Host GPU', 'gpu-check', issue)
    const receipt = await deliverDiscordWebhookFile('https://discord.com/api/webhooks/123/test-token', alert.content, true, alert.embeds)
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toEndWith('?wait=true')
    expect(requests[0].body).toMatchObject({
        content: '@everyone [HA-9050](https://hanasand.com/cases/HA-9050)',
        allowed_mentions: { parse: ['everyone'] },
        embeds: [{ title: 'HA-9050 · Host GPU', url: 'https://hanasand.com/cases/HA-9050', description: 'Host GPU is high: 81% used (alert limit 80%). Check active GPU jobs and reduce sustained load.', color: 0xED4245 }],
    })
    expect(alert.embeds[0].fields).toContainEqual({ name: 'Occurrences', value: '3', inline: true })
    expect(alert.embeds[0].fields).toContainEqual({ name: 'First seen', value: '<t:1788804660:f>', inline: true })
    expect(receipt?.id).toBe('receipt')
})

test('embeds respect case overrides, redact secrets and stay within Discord limits', () => {
    const { embeds: [embed] } = monitoringCaseDiscordAlert('HA-1', 'x'.repeat(500), 'check', { ...issue, summary: 'token=private ' + 'x'.repeat(7000), status_override: 'closed', severity_override: 'low' })
    expect(embed.title.length).toBeLessThanOrEqual(256)
    expect(embed.description.length).toBeLessThanOrEqual(4096)
    expect(embed.description).not.toContain('private')
    expect(embed.fields).toContainEqual({ name: 'Case status', value: 'closed', inline: true })
    expect(embed.fields).toContainEqual({ name: 'Severity', value: 'low', inline: true })
    expect(embed.color).toBe(0x5865F2)
    expect(embed.title.length + embed.description.length + embed.fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0)).toBeLessThanOrEqual(6000)
})

test('invalid case timestamps stay readable and warning severity keeps its color', () => {
    const alert = monitoringCaseDiscordAlert('HA-2', 'Disk usage', 'disk-check', {
        kind: 'warning', summary: 'Disk usage is near the limit', occurrences: 1,
        first_seen_at: 'invalid', last_seen_at: 'invalid',
    })
    expect(alert.embeds[0]).toMatchObject({ color: 0xFEE75C })
    expect(alert.embeds[0].fields).toContainEqual({ name: 'First seen', value: 'Unknown', inline: true })
    expect(alert.embeds[0].fields).toContainEqual({ name: 'Last seen', value: 'Unknown', inline: true })
})

test('monitoring-data warnings explain that host health is unknown', () => {
    const alert = monitoringCaseDiscordAlert('HA-3', 'Inspur CPU', 'cpu-check', {
        kind: 'warning', summary: 'Host metrics unavailable for Inspur CPU: the CPU reading (host.cpuPercent) is missing or invalid in the latest snapshot. Host status is unknown. Check the metrics collector and its latest snapshot.', occurrences: 2,
        first_seen_at: '2026-09-07T18:11:00Z', last_seen_at: '2026-09-07T18:13:00Z',
    }, null, { targetUrl: 'system:metrics' })
    expect(alert.embeds[0]).toMatchObject({ description: expect.stringContaining('Host status is unknown'), color: 0xFEE75C })
    expect(alert.embeds[0].fields).toContainEqual({ name: 'Severity', value: 'medium', inline: true })
})

test('Logs throughput case embeds retain the breached metrics from the stored summary', () => {
    const summary = 'Logs throughput is outside its configured limits: incoming event rate 135 above 100 events/s; processing rate 120 below 200 logs/s. Pending backlog: 320. Check incoming traffic, processing workers, and the pending backlog.'
    const alert = monitoringCaseDiscordAlert('HA-5', 'Log throughput thresholds', 'logs-throughput', {
        kind: 'failure', summary, occurrences: 2,
        first_seen_at: '2026-10-22T13:10:00Z', last_seen_at: '2026-10-22T13:11:00Z',
    })
    expect(alert.embeds[0].description).toBe(summary)
})

test('legacy host telemetry errors do not appear as high-severity host failures', () => {
    const alert = monitoringCaseDiscordAlert('HA-4', 'Inspur CPU', 'cpu-check', {
        kind: 'failure', summary: 'JSON field unavailable: host.cpuPercent.', occurrences: 31526,
        first_seen_at: '2026-09-28T01:53:00Z', last_seen_at: '2026-10-22T13:05:00Z',
    }, null, { targetUrl: 'system:metrics' })
    expect(alert.embeds[0]).toMatchObject({
        description: expect.stringContaining('Host status is unknown'), color: 0xFEE75C,
    })
    expect(alert.embeds[0].fields).toContainEqual({ name: 'Severity', value: 'medium', inline: true })
})

test('unknown monitoring state stays medium even when a legacy case has a critical override', () => {
    const alert = monitoringCaseDiscordAlert('HA-6', 'TI collection', 'ti-collection', {
        kind: 'failure', summary: 'The operation timed out. Failed after 1 attempt.', occurrences: 4,
        first_seen_at: '2026-10-22T13:03:00Z', last_seen_at: '2026-10-22T13:04:00Z', severity_override: 'critical',
    }, null, { targetUrl: 'system:ti-collection' })
    expect(alert.embeds[0]).toMatchObject({ color: 0xFEE75C, description: expect.stringContaining('collection state is unknown') })
    expect(alert.embeds[0].fields).toContainEqual({ name: 'Severity', value: 'medium', inline: true })
    expect(alert.embeds[0].fields).toContainEqual({ name: 'Monitoring result', value: 'Status unknown · monitoring data unavailable', inline: true })
})

test('known TI threshold failures retain critical severity', () => {
    const alert = monitoringCaseDiscordAlert('HA-7', 'TI delivery', 'ti-delivery', {
        kind: 'failure', summary: 'TI delivery has 12 retained incidents waiting for a first report, above the alert limit of 10. Review the timeliness dashboard and report backlog.', occurrences: 2,
        first_seen_at: '2026-10-22T13:03:00Z', last_seen_at: '2026-10-22T13:04:00Z', severity_override: 'critical',
    }, null, { targetUrl: 'system:ti-delivery' })
    expect(alert.embeds[0].fields).toContainEqual({ name: 'Severity', value: 'critical', inline: true })
    expect(alert.embeds[0].fields).toContainEqual({ name: 'Monitoring result', value: 'Check failed', inline: true })
})

test('existing text-only callers and disabled mentions are unchanged', async () => {
    interceptDelivery()
    await deliverDiscordWebhookFile('https://discord.com/api/webhooks/123/test-token', 'Mail recovered', false)
    expect(requests[0].body).toEqual({ content: 'Mail recovered', allowed_mentions: { parse: [] } })
})

test('failed webhook responses redact credentials before exposing the error', async () => {
    fetchMock.mockImplementation(async () => new Response(
        'Request failed for https://discord.com/api/webhooks/123/private-token',
        { status: 500 },
    ))

    await expect(deliverDiscordWebhookFile(
        'https://discord.com/api/webhooks/123/test-token',
        'Health check failed',
    )).rejects.toThrow('HTTP 500: Request failed for https://discord.com/api/webhooks/123/[redacted]')
})

test('organization cases and health checks carry share-link context', () => {
    const alert = monitoringCaseDiscordAlert('HA-1991', 'Disk usage', 'disk-check', {
        kind: 'failure', summary: 'Disk usage is high', occurrences: 1,
        first_seen_at: '2026-09-19T00:00:00Z', last_seen_at: '2026-09-19T00:00:00Z',
    }, 'hanasand-org')
    expect(alert.embeds[0].url).toBe('https://hanasand.com/cases/HA-1991?org=hanasand-org')
    expect(alert.embeds[0].fields?.find(field => field.name === 'Health check')?.value).toContain('&org=hanasand-org')
})
