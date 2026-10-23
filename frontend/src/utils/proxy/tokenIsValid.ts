import config from '@/config'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { identityApiUrl } from '@/utils/auth/authApiUrl'
import { headers as requestHeaders } from 'next/headers'
import { decodeInternalHeaderValue } from './internalHeaderValue'

export type TokenValidationResult = {
    valid: boolean
    state: 'valid' | 'invalid' | 'unavailable'
    token?: string
    name?: string
    avatar?: string
    expires_at?: string
    servicePages?: string[]
    canViewInternalPages?: boolean
    canEditInternalPages?: boolean
}

type TokenValidationOptions = {
    includeInternalAccess?: boolean
    deviceProof?: { proof?: string; method: string; url: string }
}

const TOKEN_VALIDATION_CACHE_MS = 5_000
const validationCache = new Map<string, { expiresAt: number; result: TokenValidationResult }>()
const validationRequests = new Map<string, Promise<TokenValidationResult>>()

export default async function tokenIsValid(token: string, id: string, impersonationToken?: string, options: TokenValidationOptions = {}): Promise<TokenValidationResult> {
    const serviceKey = token.startsWith('hsk_')
    // Service keys keep their own endpoint scopes, with the same short freshness window as human sessions.
    if (!serviceKey) {
        const verified = await verifiedProxySession(id, token)
        if (verified) return verified
        const deviceProof = options.deviceProof || await currentDeviceProof()
        return validateToken(token, id, impersonationToken, deviceProof)
    }
    const key = `service:${id}:${token}`
    const cached = validationCache.get(key)
    if (cached && cached.expiresAt > Date.now()) return cached.result

    const pending = validationRequests.get(key)
    if (pending) return pending

    const request = validateServiceToken(token, id)
    validationRequests.set(key, request)
    try {
        const result = await request
        if (result.state !== 'unavailable') {
            validationCache.delete(key)
            // Bound retained bearer tokens and results as the active user population grows.
            if (validationCache.size >= 10_000) validationCache.delete(validationCache.keys().next().value!)
            validationCache.set(key, { expiresAt: Date.now() + TOKEN_VALIDATION_CACHE_MS, result })
        }
        return result
    } finally {
        validationRequests.delete(key)
    }
}

async function validateToken(token: string, id: string, impersonationToken: string | undefined, deviceProof?: TokenValidationOptions['deviceProof']): Promise<TokenValidationResult> {
    try {
        const headers = {
            Authorization: `Bearer ${token}`,
            ...(deviceProof?.proof ? { DPoP: deviceProof.proof } : {}),
            ...(deviceProof ? {
                'x-device-proof-url': deviceProof.url,
                'x-device-proof-method': deviceProof.method,
            } : {}),
            ...(impersonationToken ? { 'x-impersonation-token': impersonationToken } : {}),
        }
        const response = await fetchWithRetry(`${identityApiUrl()}/auth/token/${encodeURIComponent(id)}`, {
            headers,
            timeoutMs: 10000,
            // A DPoP proof is one-use. Retrying this request would replay its jti.
            retries: deviceProof?.proof ? 0 : 2,
        })

        if (!response.ok) {
            return { valid: false, state: tokenValidationState(response.status) }
        }

        const data = await response.json()
        return {
            valid: true,
            state: 'valid',
            token: data.token,
            canViewInternalPages: data.canViewInternalPages === true,
            canEditInternalPages: data.canEditInternalPages === true,
            name: data.name,
            avatar: data.avatar,
            expires_at: data.expires_at,
        }
    } catch (error) {
        console.log(`API Error (proxy/tokenIsValid.ts): ${error}`, {
            message: (error as Error).message,
            stack: (error as Error).stack,
        })

        return { valid: false, state: 'unavailable' }
    }
}

export function tokenValidationState(status: number): TokenValidationResult['state'] {
    if (status === 401 || status === 403) return 'invalid'
    if (status >= 500) return 'unavailable'
    return 'unavailable'
}

async function verifiedProxySession(id: string, token: string): Promise<TokenValidationResult | null> {
    try {
        const headers = await requestHeaders()
        if (headers.get('x-hanasand-session-validated') !== '1'
            || decodeInternalHeaderValue(headers.get('x-hanasand-session-id')) !== id
            || headers.get('x-hanasand-session-token') !== token) return null
        return {
            valid: true,
            state: 'valid',
            token,
            name: decodeInternalHeaderValue(headers.get('x-hanasand-session-name')) || undefined,
            avatar: decodeInternalHeaderValue(headers.get('x-hanasand-session-avatar')) || undefined,
            expires_at: headers.get('x-hanasand-session-expires-at') || undefined,
            canViewInternalPages: headers.get('x-hanasand-session-can-view-internal') === '1',
            canEditInternalPages: headers.get('x-hanasand-session-can-edit-internal') === '1',
        }
    } catch {
        return null
    }
}

async function currentDeviceProof(): Promise<TokenValidationOptions['deviceProof']> {
    try {
        const headers = await requestHeaders()
        const proof = headers.get('dpop') || undefined
        const url = headers.get('x-device-proof-url')
        if (!proof || !url) return undefined
        return { proof, url, method: headers.get('x-device-proof-method') || 'GET' }
    } catch {
        return undefined
    }
}

async function validateServiceToken(token: string, id: string): Promise<TokenValidationResult> {
    try {
        const response = await fetch(`${config.url.api}/service-accounts/self`, {
            headers: { 'X-API-Key': token }, cache: 'no-store', signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) return { valid: false, state: tokenValidationState(response.status) }
        const data = await response.json()
        if (data.id !== id || !Array.isArray(data.pages)) return { valid: false, state: 'invalid' }
        return { valid: true, state: 'valid', name: data.name, servicePages: data.pages }
    } catch { return { valid: false, state: 'unavailable' } }
}
