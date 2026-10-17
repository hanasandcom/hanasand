export function createRequester(runtime) {
    return async function request(label, path, {
        method = 'GET',
        headers = {},
        body,
        expectStatus = [200],
        expect = () => true,
    } = {}) {
        const started = performance.now()
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        let response

        try {
            response = await fetch(`${runtime.apiBase}${path}`, {
                method,
                headers: {
                    ...(body ? { 'Content-Type': 'application/json' } : {}),
                    ...headers,
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            })
        } catch (error) {
            const elapsed = Math.round(performance.now() - started)
            runtime.results.push({
                label,
                method,
                path,
                status: 0,
                elapsed,
                ok: false,
                shape: 'request-error',
                keys: '',
                body: error instanceof Error ? error.message : String(error),
            })
            return { res: null, body: null, elapsed }
        } finally {
            clearTimeout(timeout)
        }

        const elapsed = Math.round(performance.now() - started)
        const parsed = await parseResponse(response)
        const statuses = Array.isArray(expectStatus) ? expectStatus : [expectStatus]
        const ok = statuses.includes(response.status) && expect(parsed, response)
        runtime.results.push({
            label,
            method,
            path,
            status: response.status,
            elapsed,
            ok,
            shape: Array.isArray(parsed) ? `array(${parsed.length})` : typeof parsed,
            keys: runtime.expectObject(parsed) ? Object.keys(parsed).slice(0, 8).join(',') : '',
            body: ok ? undefined : parsed,
        })

        return { res: response, body: parsed, elapsed }
    }
}

async function parseResponse(response) {
    const text = await response.text()
    if (!text) return null

    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}
