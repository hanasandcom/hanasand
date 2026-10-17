import { mailConfig } from './config.ts'
import type { JmapSession } from './jmapTypes.ts'

const CORE = 'urn:ietf:params:jmap:core'
const MAIL = 'urn:ietf:params:jmap:mail'
export const JMAP_TIMEOUT_MS = Number(process.env.MAIL_JMAP_TIMEOUT_MS || 8000)

export async function getMailSession(username: string, password: string) {
    const response = await fetch(new URL('/jmap/session', ensureTrailingSlash(mailConfig.internalUrl)), {
        headers: authHeaders(username, password),
        cache: 'no-store',
        signal: AbortSignal.timeout(JMAP_TIMEOUT_MS),
    })

    if (!response.ok) {
        throw new Error(`Unable to reach mail session endpoint: ${response.status}`)
    }

    const session = await response.json() as JmapSession
    const accountId = session.primaryAccounts?.[MAIL]
    if (!accountId) {
        throw new Error('No primary mail account available.')
    }

    return { session, accountId }
}

export async function jmapCall<T = unknown>(username: string, password: string, session: JmapSession, methodCalls: Array<[string, Record<string, unknown>, string]>, using: string[] = [CORE, MAIL]) {
    const response = await fetch(toMailServiceUrl(session.apiUrl), {
        method: 'POST',
        headers: {
            ...authHeaders(username, password),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ using, methodCalls }),
        signal: AbortSignal.timeout(JMAP_TIMEOUT_MS),
    })

    if (!response.ok) {
        throw new Error(`JMAP request failed (${response.status}).`)
    }

    const payload = await response.json() as { methodResponses?: Array<[string, T, string]> }
    const result = payload.methodResponses?.[payload.methodResponses.length - 1]
    if (!result || result[0] === 'error') throw new Error('Mail request failed. Please retry.')
    return result[1] as T
}

export function toMailServiceUrl(apiUrl: string) {
    try {
        const url = new URL(apiUrl)
        url.protocol = new URL(mailConfig.internalUrl).protocol
        url.host = new URL(mailConfig.internalUrl).host
        return url.toString()
    } catch {
        return new URL('/jmap/', ensureTrailingSlash(mailConfig.internalUrl)).toString()
    }
}

export function authHeaders(username: string, password: string) {
    return {
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        Accept: 'application/json',
    }
}

function ensureTrailingSlash(value: string) {
    return value.endsWith('/') ? value : `${value}/`
}
