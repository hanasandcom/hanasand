import type { RuntimeLog } from '@/utils/logs/types'

export function formatLoad(load: number[] | undefined): string {
    if (!load?.length) return 'Connecting'
    return load.map((value) => typeof value === 'number' ? value.toFixed(2) : String(value)).join(' / ')
}

export function portLabel(ports?: DockerContainerPort[]) {
    if (!ports?.length) return ''
    return ports.map((port) => {
        const target = port.public_port ? `${port.public_port}->${port.private_port}` : String(port.private_port)
        return `${target}/${port.type}`
    }).join(', ')
}

export function formatLogTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toISOString().slice(11, 19)
}

export function logLevelClass(level: RuntimeLog['level']) {
    if (level === 'error' || level === 'fatal') return 'text-ui-text'
    if (level === 'warn') return 'text-ui-warning'
    if (level === 'debug') return 'text-ui-primary'
    return 'text-ui-success'
}

export async function responseErrorMessage(response: Response, label: string) {
    return responseErrorMessageSync(response.status, await response.text().catch(() => ''), label)
}

function responseErrorMessageSync(status: number, body: string, label: string) {
    try {
        const parsed = JSON.parse(body) as { error?: unknown, message?: unknown }
        const message = typeof parsed.error === 'string' ? parsed.error : typeof parsed.message === 'string' ? parsed.message : ''
        if (message) return `${label} reported ${status}: ${message}`
    } catch {
        // Plain text response bodies fall through.
    }
    return body.trim() ? `${label} reported ${status}: ${body.trim().slice(0, 300)}` : `${label} reported ${status}.`
}
