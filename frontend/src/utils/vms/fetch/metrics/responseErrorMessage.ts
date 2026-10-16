export async function responseErrorMessage(response: Response, label: string) {
    const body = await response.text().catch(() => '')
    try {
        const parsed = JSON.parse(body) as { error?: unknown, message?: unknown }
        const message = typeof parsed.error === 'string'
            ? parsed.error
            : typeof parsed.message === 'string'
                ? parsed.message
                : ''
        if (message) return `${label} returned ${response.status}: ${message}`
    } catch {
        // Plain text response bodies fall through.
    }

    return body.trim()
        ? `${label} returned ${response.status}: ${body.trim().slice(0, 300)}`
        : `${label} returned ${response.status}.`
}
