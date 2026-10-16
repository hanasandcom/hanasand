import { NextRequest } from 'next/server'
import { authApiUrl } from '@/utils/auth/authApiUrl'
import { safeRedirectPath } from './requestHelpers'

type AuthFailureInput = {
    req: NextRequest
    id: string
    redirectPath: string
    statusCode: number
    errorCode: string
    message: string
    upstreamStatus?: number
}

export async function recordFrontendAuthFailure(input: AuthFailureInput) {
    const requestId = requestIdFor(input.req)
    const path = '/api/auth/login'
    const event = {
        service: 'hanasand-frontend',
        host: 'next-auth-route',
        level: input.statusCode >= 500 ? 'error' : 'warn',
        message: `POST ${path} failed with ${input.statusCode} ${input.errorCode}`,
        metadata: {
            category: 'http_response_error',
            surface: 'auth',
            method: 'POST',
            path,
            status_code: input.statusCode,
            upstream_status: input.upstreamStatus || null,
            error_code: input.errorCode,
            error_message: input.message,
            request_id: requestId,
            user_id: input.id,
            redirect_path: safeRedirectPath(input.redirectPath),
            ip: ipFor(input.req),
            user_agent: (input.req.headers.get('user-agent') || '').slice(0, 300),
            referer: (input.req.headers.get('referer') || input.req.headers.get('referrer') || '').slice(0, 500),
        },
    }

    console.warn(JSON.stringify({
        event: 'frontend_auth_failure',
        status_code: input.statusCode,
        error_code: input.errorCode,
        request_id: requestId,
        user_id: input.id,
        redirect_path: safeRedirectPath(input.redirectPath),
    }))

    const token = process.env.VM_API_TOKEN
    if (!token) return

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 750)
    try {
        await fetch(`${authApiUrl().replace(/\/$/, '')}/logs/ingest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'x-request-id': requestId,
            },
            body: JSON.stringify(event),
            cache: 'no-store',
            signal: controller.signal,
        })
    } catch {
        // Console fallback above keeps the failure visible in runtime logs if the API is down.
    } finally {
        clearTimeout(timeout)
    }
}

export function requestIdFor(req: NextRequest) {
    return req.headers.get('x-request-id') || crypto.randomUUID()
}

function ipFor(req: NextRequest) {
    const forwarded = req.headers.get('x-forwarded-for')
    if (forwarded) return forwarded.split(',')[0]?.trim() || ''
    return req.headers.get('x-real-ip') || ''
}

export function normalizeErrorCode(value: unknown) {
    if (typeof value !== 'string') return 'login_failed'
    return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'login_failed'
}

export function normalizeMessage(value: unknown) {
    if (typeof value !== 'string') return 'Unable to log in.'
    return value.trim().slice(0, 500) || 'Unable to log in.'
}
