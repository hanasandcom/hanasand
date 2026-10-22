import { clientHeaders } from '@/utils/auth/clientHeaders'
import { NextRequest, NextResponse } from 'next/server'
import { authenticatedSessionResponse } from '../_authCookies'
import { identityApiUrl } from '@/utils/auth/authApiUrl'
import { normalizeErrorCode, normalizeMessage, recordFrontendAuthFailure, requestIdFor } from './failureLogging'
import { authRedirect, parseAuthBody, parseJson } from './requestHelpers'

const LOGIN_AUTH_TIMEOUT_MS = 15_000

export async function POST(req: NextRequest) {
    const { body, redirectPath, wantsRedirect } = await parseAuthBody(req, form => ({
        id: String(form.get('username') || form.get('id') || ''),
        password: String(form.get('password') || ''),
    }))
    const id = String(body?.id || (body as { username?: string } | null)?.username || '').trim()
    const password = body?.password

    if (!id || !password) {
        if (wantsRedirect) {
            return authRedirect(redirectPath, 'Username and password are required.')
        }
        return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
    }

    const requestId = requestIdFor(req)
    const timeoutSignal = AbortSignal.timeout(LOGIN_AUTH_TIMEOUT_MS)
    let upstream: Response
    let responseText: string
    try {
        upstream = await fetch(`${identityApiUrl()}/auth/login/${encodeURIComponent(id)}`, {
            method: 'POST',
            headers: { ...clientHeaders(req.headers), 'Content-Type': 'application/json', 'x-request-id': requestId },
            body: JSON.stringify({ password }),
            cache: 'no-store',
            signal: timeoutSignal,
        })
        responseText = await upstream.text()
    } catch (error) {
        const timedOut = timeoutSignal.aborted || (error as { name?: unknown } | null)?.name === 'TimeoutError'
        const statusCode = timedOut ? 504 : 502
        const errorCode = timedOut ? 'auth_service_timeout' : 'auth_service_unavailable'
        const message = timedOut
            ? 'Authentication service timed out. Please try again.'
            : 'Authentication service is unavailable.'
        await recordFrontendAuthFailure({
            req,
            id,
            redirectPath,
            statusCode,
            errorCode,
            message,
        })
        if (wantsRedirect) {
            return authRedirect(redirectPath, message)
        }
        return NextResponse.json({ error: message, code: errorCode }, { status: statusCode })
    }
    const data = parseJson(responseText)

    if (!upstream.ok) {
        await recordFrontendAuthFailure({
            req,
            id,
            redirectPath,
            statusCode: upstream.status,
            errorCode: normalizeErrorCode(data?.code || data?.error || responseText || `http_${upstream.status}`),
            message: normalizeMessage(data?.error || data?.message || responseText || 'Unable to log in.'),
            upstreamStatus: upstream.status,
        })
        if (wantsRedirect) {
            return authRedirect(redirectPath, data?.error || responseText || 'Unable to log in.')
        }
        return NextResponse.json(data || { error: responseText || 'Unable to log in.' }, { status: upstream.status })
    }
    if (!data?.token || !data?.id || !data?.name) {
        await recordFrontendAuthFailure({
            req,
            id,
            redirectPath,
            statusCode: 502,
            errorCode: 'session_create_failed',
            message: 'Login succeeded, but the session could not be created.',
            upstreamStatus: upstream.status,
        })
        if (wantsRedirect) {
            return authRedirect(redirectPath, 'Login succeeded, but the session could not be created.')
        }
        return NextResponse.json({ error: 'Login succeeded, but the session could not be created.' }, { status: 502 })
    }

    return authenticatedSessionResponse(req, data, wantsRedirect, redirectPath)
}
