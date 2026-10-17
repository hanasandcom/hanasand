import { readState, writeState } from './login-ui-monitor-storage.mjs'

export async function handleResult(result, config) {
    const previous = await readState(config.statePath)
    const alertErrors = []
    const next = {
        ...result,
        checkedAt: config.now.toISOString(),
        baseUrl: config.baseUrl,
        username: config.username,
        failureScreenshotPath: result.ok ? undefined : config.failureScreenshotPath,
        lastAlertAt: previous.lastAlertAt || null,
        alertErrors,
    }

    if (result.ok && previous.ok === false) {
        const sent = await trySendDiscord({
            status: 'RECOVERED', color: 0x22c55e, title: 'Hanasand login UI recovered',
            description: result.detail, fields: resultFields(result, config),
        }, config, alertErrors)
        if (sent) next.lastAlertAt = config.now.toISOString()
    }

    if (!result.ok && shouldSendFailureAlert(previous, config)) {
        const sent = await trySendDiscord({
            status: 'DOWN', color: 0xef4444, title: 'Hanasand login UI failed',
            description: result.detail, fields: resultFields(result, config),
        }, config, alertErrors)
        if (sent) next.lastAlertAt = config.now.toISOString()
    }

    await writeState(config.statePath, next)
    console.log(JSON.stringify(next))
}

function shouldSendFailureAlert(previous, { repeatAlertMinutes }) {
    if (previous.ok !== false) return true
    if (!previous.lastAlertAt) return true
    const lastAlertAt = new Date(previous.lastAlertAt).getTime()
    if (!Number.isFinite(lastAlertAt)) return true
    return (Date.now() - lastAlertAt) / 60_000 >= repeatAlertMinutes
}

async function trySendDiscord(payload, config, alertErrors) {
    try {
        await sendDiscord(payload, config)
        return true
    } catch (error) {
        alertErrors.push(error instanceof Error ? error.message : String(error))
        return false
    }
}

async function sendDiscord({ status, color, title, description, fields }, { discordWebhookUrl, now }) {
    if (!discordWebhookUrl) {
        throw new Error(`DISCORD_WEBHOOK_URL is required to alert login monitor status=${status}`)
    }

    const response = await fetch(discordWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: status === 'DOWN' ? '@here Hanasand login UI check failed.' : undefined,
            embeds: [{ title, description: truncate(description, 900), color, timestamp: now.toISOString(), fields }],
        }),
    })

    if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Discord webhook failed ${response.status}: ${truncate(body, 300)}`)
    }
}

function resultFields(result, { baseUrl, username, failureScreenshotPath }) {
    return [
        { name: 'URL', value: baseUrl, inline: true },
        { name: 'User', value: username, inline: true },
        { name: 'Latency', value: `${result.latencyMs}ms`, inline: true },
        { name: 'Reason', value: result.reason, inline: true },
        ...(result.ok ? [] : [{ name: 'Failure screenshot', value: failureScreenshotPath, inline: false }]),
    ]
}

function truncate(value, max) {
    const text = String(value || '')
    return text.length > max ? `${text.slice(0, max - 1)}...` : text
}
