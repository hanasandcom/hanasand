export function createApiRequester(apiBase) {
    return async function request(path, init = {}) {
        const response = await fetch(`${apiBase}${path}`, {
            ...init,
            headers: {
                ...(init.body ? { 'Content-Type': 'application/json' } : {}),
                ...(init.headers || {}),
            },
        })

        const text = await response.text()
        let body
        try {
            body = text ? JSON.parse(text) : null
        } catch {
            body = text
        }

        return { response, body }
    }
}
