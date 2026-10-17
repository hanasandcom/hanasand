import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
    baseUrl, cdnBaseUrl, cdnUploadFolder, cdnUploadToken, cdnUploadUser,
    dashboardPath, failureScreenshotPath, failureThreshold, now, statePath,
    statusIngestBaseUrl, statusIngestToken, timeoutMs,
} from './monitor-config.mjs'
export async function handleResult(result, options = {}, serviceAccountId = '') {
    const resultStatePath = options.statePath || statePath
    const service = options.service || 'database'
    const checkName = options.checkName || 'Database dashboard'
    const previous = await readState(resultStatePath)
    const alertErrors = []
    const backupFailure = String(result.reason || '').startsWith('ti_backup_')
    const next = {
        ...result,
        checkedAt: now.toISOString(),
        baseUrl,
        dashboardPath,
        serviceAccountId,
        failureScreenshotPath: result.ok ? undefined : failureScreenshotPath,
        failureScreenshotUrl: result.failureScreenshotUrl,
        lastAlertAt: previous.lastAlertAt || null,
        failureCount: result.ok ? 0 : Number(previous.failureCount || 0) + 1,
        failureThreshold,
        alertErrors,
    }
    if (!result.ok && !backupFailure && !options.noScreenshot && next.failureCount === failureThreshold) {
        next.failureScreenshotUrl = await uploadFailureScreenshot().catch(error => {
            alertErrors.push(error instanceof Error ? error.message : String(error))
            return ''
        })
    }
    await sendStatusIngest(service, checkName, {
        ...result,
        detail: next.failureScreenshotUrl ? `${result.detail} Evidence: ${next.failureScreenshotUrl}` : result.detail,
    }).catch(error => { alertErrors.push(error instanceof Error ? error.message : String(error)) })
    await writeState(next, resultStatePath)
    console.log(JSON.stringify(next))
}

export async function sendStatusIngest(service, checkName, result) {
    if (!statusIngestToken) throw new Error('HANASAND_STATUS_INGEST_TOKEN is required to persist monitor results and update cases')
    const response = await fetch(`${statusIngestBaseUrl}/api/status/ingest`, {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${statusIngestToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            service,
            check_name: checkName,
            status: result.ok ? 'up' : 'down',
            latency_ms: result.latencyMs,
            message: result.detail,
        }),
    })
    if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`Status ingest failed ${response.status}: ${truncate(body, 240)}`)
    }
}

async function uploadFailureScreenshot() {
    const image = await readFile(failureScreenshotPath)
    if (!image.length) return ''
    const timestamp = now.toISOString().replace(/[-:.]/g, '').replace('T', '-').replace('Z', 'Z')
    const path = `${cdnUploadFolder}/db-dashboard-monitor-failure-${timestamp}.png`
    const form = new FormData()
    form.set('name', `db-dashboard-monitor-failure-${timestamp}.png`)
    form.set('description', 'Database dashboard monitor failure screenshot')
    form.set('path', path)
    form.set('type', 'image/png')
    form.set('file', new Blob([image], { type: 'image/png' }), `db-dashboard-monitor-failure-${timestamp}.png`)
    const headers = cdnUploadUser && cdnUploadToken ? { Authorization: `Bearer ${cdnUploadToken}`, id: cdnUploadUser } : undefined
    const response = await fetch(`${cdnBaseUrl}/files`, { method: 'POST', headers, body: form })
    if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(`CDN screenshot upload failed ${response.status}: ${truncate(body, 240)}`)
    }
    return `${cdnBaseUrl}/files/path/${encodeURIComponent(path)}`
}

async function readState(path = statePath) {
    try {
        return JSON.parse(await readFile(path, 'utf8'))
    } catch {
        return {}
    }
}

async function writeState(state, path = statePath) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(state, null, 2)}\n`)
}

function truncate(value, max) {
    const text = String(value || '')
    return text.length > max ? `${text.slice(0, max - 1)}...` : text
}
