import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type BrowserContextOptions } from '@playwright/test'
import { apiBase, password, adminId, adminPassword, hasAdminLoginCredentials } from './dashboard-resource-data'

export async function createUser(request: APIRequestContext, id: string, name: string) {
    const response = await request.post(`${apiBase}/user`, {
        data: { id, name, password },
    })
    expect(response.ok()).toBeTruthy()
    return await response.json() as {
        id: string
        name: string
        token: string
        expires_at: string
    }
}

export function uniqueSuffix() {
    return `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 6)}`
}

export function authHeaders(auth: { id: string, token: string }) {
    return {
        Authorization: `Bearer ${decodeURIComponent(auth.token)}`,
        id: auth.id,
        'Content-Type': 'application/json',
    }
}

export async function createShare(request: APIRequestContext, auth: { id: string, token: string }, data: {
    id: string
    name: string
    path: string
    content: string
    type: 'file' | 'folder'
    includeTree?: boolean
}) {
    const response = await request.post(`${apiBase}/share`, {
        headers: authHeaders(auth),
        data,
    })
    expect(response.ok()).toBeTruthy()
    return await response.json()
}

export async function deleteUser(request: APIRequestContext, id: string, secret: string) {
    const loginResponse = await request.post(`${apiBase}/auth/login/${id}`, {
        data: { password: secret },
    })

    if (!loginResponse.ok()) {
        return
    }

    const token = (await loginResponse.json()).token as string
    await request.delete(`${apiBase}/user/self`, {
        headers: {
            Authorization: `Bearer ${decodeURIComponent(token)}`,
            id,
            'Content-Type': 'application/json',
        },
        data: { id },
    })
}

export async function authenticateContext(context: BrowserContext, auth: {
    id: string
    name: string
    token: string
    expires_at: string
}, baseURL: string) {
    const expires = Math.floor(new Date(auth.expires_at).getTime() / 1000)
    const cookieUrl = new URL(baseURL).origin
    const secure = cookieUrl.startsWith('https://')

    await context.addCookies([
        { name: 'id', value: encodeURIComponent(auth.id), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
        { name: 'name', value: encodeURIComponent(auth.name), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
        { name: 'access_token', value: encodeURIComponent(auth.token), url: cookieUrl, expires, httpOnly: false, secure, sameSite: 'Lax' },
    ])
}

export async function createDashboardUserSession(
    browser: Browser,
    request: APIRequestContext,
    baseURL: string | undefined,
    id: string,
    name: string,
    options: Omit<BrowserContextOptions, 'baseURL'> = {},
) {
    const auth = await createUser(request, id, name)
    let context: BrowserContext | undefined

    try {
        context = await browser.newContext({ ...options, baseURL })
        await authenticateContext(context, auth, baseURL || 'http://127.0.0.1:3000')
    } catch (error) {
        if (context) {
            await context.close().catch(() => undefined)
        }
        await deleteUser(request, id, password).catch(() => undefined)
        throw error
    }
    if (!context) throw new Error('Dashboard browser context was not created.')

    const cleanup = async() => {
        let closeError: unknown
        try {
            await context.close()
        } catch (error) {
            closeError = error
        }
        await deleteUser(request, id, password)
        if (closeError) throw closeError
    }
    return { auth, context, cleanup }
}

export async function loginAsAdmin(request: APIRequestContext) {
    test.skip(!hasAdminLoginCredentials, 'Privileged dashboard smoke needs explicit PLAYWRIGHT_ADMIN_ID/PLAYWRIGHT_ADMIN_PASSWORD.')

    const loginResponse = await request.post(`${apiBase}/auth/login/${adminId}`, {
        data: { password: adminPassword },
    })
    test.skip(!loginResponse.ok(), 'Privileged dashboard smoke needs PLAYWRIGHT_ADMIN_TOKEN or valid PLAYWRIGHT_ADMIN_ID/PLAYWRIGHT_ADMIN_PASSWORD.')
    return await loginResponse.json() as {
        id: string
        name: string
        token: string
        expires_at: string
    }
}
