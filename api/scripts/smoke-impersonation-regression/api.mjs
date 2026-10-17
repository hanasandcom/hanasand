import crypto from 'crypto'

export function expect(condition, message, details) {
    if (!condition) {
        const error = new Error(message)
        if (details !== undefined) error.details = details
        throw error
    }
}

export function createSmokeApi({ password }) {
    const apiBase = process.env.API_BASE || 'http://127.0.0.1:8080/api'

    function authHeaders(userId, token, extra = {}) {
        return { Authorization: `Bearer ${token}`, id: userId, ...extra }
    }

    async function request(path, init = {}) {
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

    async function signup(id, name = id) {
        const created = await request('/user', {
            method: 'POST',
            body: JSON.stringify({ id, name, password }),
        })
        expect(created.response.status === 201, `Failed to create user ${id}.`, created.body)
    }

    async function login(id) {
        const loggedIn = await request(`/auth/login/${id}`, {
            method: 'POST',
            body: JSON.stringify({ password }),
        })
        expect(Boolean(loggedIn.body?.token), `Failed to log in user ${id}.`, loggedIn.body)
        return loggedIn.body.token
    }

    return { request, authHeaders, signup, login }
}

export function tokenDigest(token) {
    return crypto.createHash('sha256').update(token).digest('hex')
}
