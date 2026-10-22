const scannerUrl = (process.env.HANASAND_SCANNER_URL || '').trim().replace(/\/$/, '')
const serviceToken = process.env.HANASAND_SCANNER_SERVICE_TOKEN || ''
const requestTimeoutMs = 30_000

export async function requestScanner<T>(route: string, options: { method?: string, body?: unknown } = {}): Promise<T> {
    if (!scannerUrl) throw new Error('HANASAND_SCANNER_URL is not configured.')
    if (!serviceToken) throw new Error('HANASAND_SCANNER_SERVICE_TOKEN is not configured.')
    const response = await fetch(`${scannerUrl}${route}`, {
        method: options.method || 'GET',
        headers: {
            'x-hanasand-service-token': serviceToken,
            ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(requestTimeoutMs),
    })
    if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(scannerErrorMessage(body, response.status))
    }
    return response.json() as Promise<T>
}

function scannerErrorMessage(body: string, status: number) {
    let code = ''
    try {
        const parsed = JSON.parse(body) as { error?: unknown, message?: unknown }
        if (typeof parsed.message === 'string' && parsed.message.trim()) return parsed.message.slice(0, 300)
        if (typeof parsed.error === 'string') code = parsed.error
    } catch { return body.slice(0, 300) || `Scanner service returned HTTP ${status}.` }
    if (code === 'tenable_scan_configuration_busy') return 'Another assessment is already running from this Tenable scan profile. Try again after it finishes.'
    if (code === 'tenable_scan_configuration_unavailable') return 'The selected Tenable scan profile is unavailable or disabled. Refresh the profile list and choose an enabled profile.'
    if (code === 'tenable_integration_not_configured') return 'Connect a Tenable Vulnerability Management account before starting this assessment.'
    return code ? code.replaceAll('_', ' ') : `Scanner service returned HTTP ${status}.`
}

export function errorMessage(error: unknown) {
    if (error instanceof Error) return error.name === 'TimeoutError' ? 'Request timed out.' : error.message
    return String(error)
}
